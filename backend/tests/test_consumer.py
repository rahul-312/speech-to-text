import asyncio
import contextlib

import pytest
from channels.testing import WebsocketCommunicator

from transcriptions import transcriber
from transcriptions.consumers import TranscribeConsumer
from transcriptions.models import Transcription

pytestmark = pytest.mark.django_db(transaction=True)
CHUNK = b"\0" * 3200  # 100 ms


class FakeEngine:
    """First chunk gives interim+final; finish gives an unfinalized interim."""

    fail = False

    def __init__(self):
        self.out = asyncio.Queue()
        self.sent = 0

    async def send(self, _pcm):
        self.sent += 1
        if self.fail:
            await self.out.put(RuntimeError("429 quota"))
        elif self.sent == 1:
            await self.out.put(("interim", "नमस्ते"))
            await self.out.put(("final", "नमस्ते world "))

    async def finish(self):
        await self.out.put(("interim", "last words"))

    async def events(self):
        while True:
            event = await self.out.get()
            if isinstance(event, Exception):
                raise event
            yield event


@pytest.fixture
def engine(monkeypatch, settings):
    settings.APP_PASSCODE = "secret"
    settings.FLUSH_IDLE_SECONDS = 0.2
    TranscribeConsumer.active = 0
    holder = FakeEngine

    @contextlib.asynccontextmanager
    async def fake_open():
        yield holder()

    monkeypatch.setattr(transcriber, "open_transcriber", fake_open)
    return holder


async def start(passcode="secret"):
    ws = WebsocketCommunicator(TranscribeConsumer.as_asgi(), "/ws/transcribe")
    assert (await ws.connect())[0]
    await ws.send_json_to({"type": "start", "passcode": passcode, "title": "T"})
    return ws


async def until(ws, kind):
    seen = []
    while True:
        message = await ws.receive_json_from(timeout=5)
        seen.append(message)
        if message["type"] == kind:
            return seen


async def test_happy_path_saves_finals_and_trailing_interim(engine):
    ws = await start()
    await until(ws, "ready")
    await ws.send_to(bytes_data=CHUNK)
    await until(ws, "final")
    await ws.send_to(bytes_data=CHUNK)
    await ws.send_json_to({"type": "stop"})
    assert (await until(ws, "done"))[-1]["status"] == "completed"
    item = await Transcription.objects.aget()
    assert item.status == "completed" and item.duration_ms == 200
    segments = [(s.seq, s.text) async for s in item.segments.all()]
    assert segments == [(1, "नमस्ते world"), (2, "last words")]
    assert TranscribeConsumer.active == 0


async def test_bad_passcode(engine):
    ws = await start("wrong")
    assert (await ws.receive_json_from())["code"] == "passcode"
    assert (await ws.receive_output())["code"] == 4401
    assert await Transcription.objects.acount() == 0


async def test_disconnect_keeps_text_and_marks_interrupted(engine):
    ws = await start()
    await until(ws, "ready")
    await ws.send_to(bytes_data=CHUNK)
    await until(ws, "final")
    await ws.disconnect(timeout=5)
    item = await Transcription.objects.aget()
    assert item.status == "interrupted"
    assert await item.segments.acount() == 2
    assert TranscribeConsumer.active == 0


async def test_cap_is_enforced_by_server(engine, settings):
    settings.MAX_RECORDING_MS = 300
    ws = await start()
    await until(ws, "ready")
    for _ in range(6):
        await ws.send_to(bytes_data=CHUNK)
    kinds = [m["type"] for m in await until(ws, "done")]
    assert "limit" in kinds
    item = await Transcription.objects.aget()
    assert item.status == "completed" and item.duration_ms == 300


async def test_engine_error_is_reported(engine, monkeypatch):
    monkeypatch.setattr(engine, "fail", True)
    ws = await start()
    await until(ws, "ready")
    await ws.send_to(bytes_data=CHUNK)
    seen = await until(ws, "done")
    assert any("free-tier" in m.get("message", "") for m in seen)
    assert (await Transcription.objects.aget()).status == "interrupted"


async def test_concurrency_limit(engine, settings):
    settings.MAX_CONCURRENT_RECORDINGS = 0
    ws = await start()
    assert "busy" in (await ws.receive_json_from())["message"]
