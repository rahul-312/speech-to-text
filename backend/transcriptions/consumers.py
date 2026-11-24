import asyncio
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from . import polish, transcriber
from .models import Segment, Transcription
from .permissions import passcode_ok

log = logging.getLogger(__name__)

BYTES_PER_MS = 32  # 16 kHz * 16-bit mono
MAX_CHUNK_BYTES = 64_000
QUEUE_SIZE = 200  # about 20 s of 100 ms chunks
STOP = object()
ABORT = object()


class TranscribeConsumer(AsyncWebsocketConsumer):
    """Client: start(JSON), audio(binary), stop(JSON).
    Server: ready, interim, final, limit, polishing, polished, error, done."""

    active = 0  # single process, so a class counter is enough

    async def connect(self):
        self.runner = None
        self.queue = asyncio.Queue(QUEUE_SIZE)
        self.disconnected = False
        self.stopping = False
        await self.accept()

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            await self._on_audio(bytes_data)
            return
        try:
            message = json.loads(text_data or "")
            kind = message["type"]
        except (ValueError, TypeError, KeyError):
            await self._emit("error", message="Malformed message")
            return
        if kind == "start" and self.runner is None:
            await self._on_start(message)
        elif kind == "stop" and self.runner and not self.stopping:
            self.stopping = True
            await self.queue.put(STOP)

    async def _on_start(self, message):
        if not passcode_ok(message.get("passcode", "")):
            await self._emit("error", message="Invalid passcode", code="passcode")
            await self.close(code=4401)
            return
        cls = TranscribeConsumer
        if cls.active >= settings.MAX_CONCURRENT_RECORDINGS:
            await self._emit("error", message="Server is busy, try again shortly")
            await self.close(code=4429)
            return
        cls.active += 1
        self.runner = asyncio.create_task(self._run(message.get("title")))

    async def _on_audio(self, data):
        if self.runner is None or self.stopping or self.runner.done():
            return
        if not data or len(data) > MAX_CHUNK_BYTES or len(data) % 2:
            await self._emit("error", message="Invalid audio chunk")
            return
        try:
            self.queue.put_nowait(data)
        except asyncio.QueueFull:
            self.stopping = True
            await self._emit("error", message="Transcription fell too far behind")
            await self.queue.put(ABORT)

    async def disconnect(self, code):
        self.disconnected = True
        if self.runner and not self.runner.done():
            # Flush and save rather than cancel, so finalized words are kept.
            if not self.stopping:
                self.stopping = True
                await self.queue.put(ABORT)
            await self.runner

    async def _run(self, title):
        self.audio_ms = 0
        self.audio = bytearray()
        self.live = []
        self.seq = 0
        self.segment_start = None
        self.last_end = 0
        self.pending = ""
        self.item = None
        status = Transcription.Status.INTERRUPTED
        try:
            title = title.strip()[:200] if isinstance(title, str) else ""
            async with asyncio.timeout(15):
                engine_cm = transcriber.open_transcriber()
                engine = await engine_cm.__aenter__()
            try:
                self.item = await Transcription.objects.acreate(
                    title=title or timezone.now().strftime("Recording %d %b %Y, %H:%M UTC"),
                    status=Transcription.Status.RECORDING,
                )
                await self._emit(
                    "ready", id=str(self.item.id), max_ms=settings.MAX_RECORDING_MS
                )
                if await self._stream(engine):
                    status = Transcription.Status.COMPLETED
            finally:
                await engine_cm.__aexit__(None, None, None)
        except Exception as exc:
            log.exception("Transcription failed")
            await self._emit("error", message=_friendly(exc))
        finally:
            self.stopping = True
            try:
                await self._finalize(status)
                if status == Transcription.Status.COMPLETED and not self.disconnected:
                    await self._polish()
            except Exception:
                log.exception("Could not finalize transcription")
            finally:
                TranscribeConsumer.active -= 1

        if self.item:
            await self._emit("done", id=str(self.item.id), status=status)
        if not self.disconnected:
            await self.close()

    async def _stream(self, engine) -> bool:
        """Run upload and download together. True when the user (or cap) ended it."""
        self.last_event = asyncio.get_running_loop().time()
        pump = asyncio.create_task(self._pump(engine))
        consume = asyncio.create_task(self._consume(engine))
        try:
            await asyncio.wait({pump, consume}, return_when=asyncio.FIRST_COMPLETED)
            if not pump.done():
                consume.result()  # raises the engine error, if there was one
                raise ConnectionError("Engine closed the session early")
            clean = pump.result()
            await self._flush(consume)
            return clean
        finally:
            for task in (pump, consume):
                task.cancel()
            await asyncio.gather(pump, consume, return_exceptions=True)

    async def _pump(self, engine) -> bool:
        deadline = asyncio.get_running_loop().time() + settings.MAX_RECORDING_MS / 1000
        clean = True
        while True:
            try:
                async with asyncio.timeout(settings.AUDIO_IDLE_SECONDS):
                    item = await self.queue.get()
            except TimeoutError:
                await self._emit("error", message="No audio received")
                clean = False
                break
            if item is STOP:
                break
            if item is ABORT:
                clean = False
                break
            await engine.send(item)
            self.audio += item
            self.audio_ms += len(item) // BYTES_PER_MS
            if (
                self.audio_ms >= settings.MAX_RECORDING_MS
                or asyncio.get_running_loop().time() >= deadline
            ):
                await self._emit("limit")
                break
        self.stopping = True
        await engine.finish()
        return clean

    async def _consume(self, engine):
        async for kind, text in engine.events():
            self.last_event = asyncio.get_running_loop().time()
            if self.segment_start is None:
                self.segment_start = self.last_end
            if kind == "interim":
                self.pending = text
                await self._emit("interim", text=text)
            else:
                await self._save_final(text)

    async def _flush(self, consume):
        """After end-of-audio, wait for the last words to go quiet."""
        loop = asyncio.get_running_loop()
        started = self.last_event = loop.time()
        while not consume.done():
            now = loop.time()
            if (
                now - self.last_event >= settings.FLUSH_IDLE_SECONDS
                or now - started >= settings.FLUSH_MAX_SECONDS
            ):
                break
            await asyncio.wait({consume}, timeout=0.05)

    async def _save_final(self, text):
        text = text.strip()
        self.pending = ""
        start, self.segment_start = self.segment_start, None
        if not text:
            return
        self.seq += 1
        segment = await Segment.objects.acreate(
            transcription=self.item,
            seq=self.seq,
            text=text,
            original_text=text,
            start_ms=self.last_end if start is None else start,
            end_ms=self.audio_ms,
        )
        self.live.append(text)
        self.last_end = self.audio_ms
        await self._emit(
            "final",
            segment={"id": segment.id, "seq": segment.seq, "text": text},
        )

    async def _finalize(self, status):
        if self.item is None:
            return
        if self.pending:  # spoken but never finalized: keep it
            await self._save_final(self.pending)
        await Transcription.objects.filter(pk=self.item.pk).aupdate(
            status=status, duration_ms=self.audio_ms, updated_at=timezone.now()
        )

    async def _polish(self):
        """Replace the live text with a more accurate pass over the whole recording."""
        if not self.live:
            return
        await self._emit("polishing")
        parts = await polish.polish(bytes(self.audio), " ".join(self.live))
        if parts:
            segments = await self._replace_segments(parts)
            await self._emit("polished", segments=segments)

    @database_sync_to_async
    def _replace_segments(self, parts):
        with transaction.atomic():
            self.item.segments.all().delete()
            rows = [
                self.item.segments.create(
                    seq=i, text=text, original_text=text, start_ms=start, end_ms=end
                )
                for i, (start, end, text) in enumerate(parts, 1)
            ]
        return [{"id": r.id, "seq": r.seq, "text": r.text} for r in rows]

    async def _emit(self, kind, **data):
        if self.disconnected:
            return
        try:
            await self.send(text_data=json.dumps({"type": kind, **data}, ensure_ascii=False))
        except Exception:
            self.disconnected = True  # socket is gone; keep saving to the database


def _friendly(exc) -> str:
    text = str(exc).lower()
    if "gemini_api_key" in text:
        return "The server has no Gemini API key configured"
    if "429" in text or "quota" in text or "resource_exhausted" in text:
        return "Gemini free-tier limit reached, try again later"
    if "api key" in text or "401" in text or "403" in text:
        return "Gemini rejected the API key"
    if isinstance(exc, TimeoutError):
        return "Could not reach Gemini in time"
    return "The transcription service stopped unexpectedly"
