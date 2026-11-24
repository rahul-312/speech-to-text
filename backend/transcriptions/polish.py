"""Second pass: transcribe the whole recording again, with full sentence context."""

import asyncio
import base64
import io
import logging
import re
import wave
from array import array

from django.conf import settings
from google import genai
from google.genai import types

log = logging.getLogger(__name__)

RATE = 16000
FRAME = RATE // 10  # 100 ms
MIN_SECONDS, MAX_SECONDS = 40, 60  # long audio makes the model repeat itself
MAX_PARTS = 3  # the free tier allows 3 requests a minute (and 25 a day)


def split(pcm: bytes) -> list[tuple[int, int]]:
    """Return (start, end) sample positions, cutting at the quietest 100 ms."""
    samples = array("h", pcm)
    parts, start = [], 0
    while len(samples) - start > MAX_SECONDS * RATE:
        frames = range(start + MIN_SECONDS * RATE, start + MAX_SECONDS * RATE, FRAME)
        quiet = min(frames, key=lambda f: sum(map(abs, samples[f : f + FRAME])))
        cut = quiet + FRAME // 2
        parts.append((start, cut))
        start = cut
    if start < len(samples):
        parts.append((start, len(samples)))
    return parts


def plausible(texts: list[str], seconds: float, live_text: str) -> bool:
    """Reject runaway repetition and results that lost much of the live text."""
    words = sum(len(t.split()) for t in texts)
    return 0.6 * len(live_text.split()) <= words <= 6 * seconds + 10


def devanagari_share(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    return len(re.findall(r"[ऄ-ह]", text)) / max(1, len(letters))


def flips_script(texts: list[str], live_text: str) -> bool:
    """True if Roman live text came back in Devanagari, which also respells English."""
    return devanagari_share(" ".join(texts)) > devanagari_share(live_text) + 0.2


def to_wav(pcm: bytes) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm)
    return out.getvalue()


async def transcribe(client, pcm: bytes) -> str:
    audio = base64.b64encode(to_wav(pcm)).decode()
    result = await client.aio.interactions.create(
        model=settings.GEMINI_POLISH_MODEL,
        input=[{"type": "audio", "data": audio, "mime_type": "audio/wav"}],
        generation_config={"transcription_config": {"language_codes": settings.GEMINI_LANGUAGES}},
        store=False,
    )
    return (result.output_text or "").strip()


async def polish(pcm: bytes, live_text: str) -> list[tuple[int, int, str]] | None:
    """Return (start_ms, end_ms, text) parts, or None to keep the live text."""
    try:
        parts = split(pcm)
        if len(parts) > MAX_PARTS:
            return None
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(
                api_version="v1beta", retry_options=types.HttpRetryOptions(attempts=1)
            ),
        )
        async with asyncio.timeout(settings.POLISH_TIMEOUT_SECONDS):
            texts = await asyncio.gather(
                *(transcribe(client, pcm[start * 2 : end * 2]) for start, end in parts)
            )
    except Exception:
        log.exception("Polish failed; keeping live text")
        return None
    for (start, end), text in zip(parts, texts, strict=True):
        if not plausible([text], (end - start) / RATE, ""):
            return None
    if not plausible(texts, len(pcm) / 2 / RATE, live_text) or flips_script(texts, live_text):
        return None
    return [
        (start * 1000 // RATE, end * 1000 // RATE, text)
        for (start, end), text in zip(parts, texts, strict=True)
        if text
    ]
