"""Gemini live transcription, kept separate from the WebSocket so it can be faked."""

import contextlib
from collections.abc import AsyncIterator

from django.conf import settings
from google import genai
from google.genai import types


class GeminiTranscriber:
    def __init__(self, session):
        self._session = session

    async def send(self, pcm: bytes) -> None:
        await self._session.send_realtime_input(
            audio=types.Blob(data=pcm, mime_type="audio/pcm;rate=16000")
        )

    async def finish(self) -> None:
        await self._session.send_realtime_input(audio_stream_end=True)

    async def events(self) -> AsyncIterator[tuple[str, str]]:
        """Yield ("interim" | "final", text) until the session closes."""
        while True:  # receive() returns after each turn
            got_message = False
            async for message in self._session.receive():
                got_message = True
                content = message.server_content
                if content is None:
                    continue
                interim = content.interim_input_transcription
                final = content.input_transcription
                if interim and interim.text:
                    yield "interim", interim.text
                if final and final.text:
                    yield "final", final.text
            if not got_message:
                return


@contextlib.asynccontextmanager
async def open_transcriber():
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    client = genai.Client(
        api_key=settings.GEMINI_API_KEY, http_options={"api_version": "v1beta"}
    )
    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=settings.GEMINI_LANGUAGES
        ),
    )
    async with client.aio.live.connect(
        model=settings.GEMINI_MODEL, config=config
    ) as session:
        yield GeminiTranscriber(session)
