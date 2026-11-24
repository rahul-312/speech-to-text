"""Phase 0: stream a WAV to Gemini in real time and print interim/final text.

Usage (from backend/): python scripts/spike.py ../samples/hinglish.wav
"""

import asyncio
import os
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "1")
sys.stdout.reconfigure(encoding="utf-8")

import django  # noqa: E402

django.setup()
from transcriptions.transcriber import open_transcriber  # noqa: E402


async def main(path):
    with wave.open(path) as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 16000):
            sys.exit("WAV must be 16 kHz, mono, 16-bit PCM")
        pcm = wav.readframes(wav.getnframes())

    async with open_transcriber() as engine:

        async def show():
            async for kind, text in engine.events():
                print(f"[{kind}] {text}", flush=True)

        reader = asyncio.create_task(show())
        for i in range(0, len(pcm), 3200):
            await engine.send(pcm[i : i + 3200])
            await asyncio.sleep(0.1)
        await engine.finish()
        await asyncio.wait({reader}, timeout=5)
        if reader.done():
            reader.result()
        reader.cancel()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1]))
