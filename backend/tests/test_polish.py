import pytest

from transcriptions import polish
from transcriptions.polish import RATE, flips_script, plausible, split

LOUD = (1000).to_bytes(2, "little", signed=True)


def test_short_audio_is_one_part():
    assert split(LOUD * RATE * 5) == [(0, RATE * 5)]
    assert split(b"") == []


def test_long_audio_is_cut_at_the_pause():
    pcm = LOUD * RATE * 50 + b"\0\0" * RATE + LOUD * RATE * 40
    (a, b), (c, d) = split(pcm)
    assert a == 0 and b == c and d == RATE * 91
    assert 50 * RATE <= b <= 51 * RATE


def test_plausible():
    assert plausible(["hello there friend"], 2, "hello friend")
    assert not plausible(["word " * 500], 10, "")
    assert not plausible(["one"], 10, "one two three four")


@pytest.mark.parametrize("reply", [RuntimeError("503"), "word " * 5000, ""])
async def test_bad_result_keeps_live_text(monkeypatch, settings, reply):
    settings.GEMINI_API_KEY = "test"

    async def fake(_client, _pcm):
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(polish, "transcribe", fake)
    assert await polish.polish(LOUD * RATE, "hello there") is None


def test_flips_script():
    assert flips_script(["मैं मार्केट में था एंड"], "Main market mein tha and")
    assert not flips_script(["मैं market में था"], "मैं मार्केट में था")
    assert not flips_script(["Main market mein tha"], "मैं मार्केट में था")


async def test_too_long_is_not_sent(monkeypatch):
    async def fail(_client, _pcm):
        raise AssertionError("should not be called")

    monkeypatch.setattr(polish, "transcribe", fail)
    assert await polish.polish(LOUD * RATE * 400, "hello") is None
