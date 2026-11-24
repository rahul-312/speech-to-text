import pytest
from rest_framework.test import APIClient

from transcriptions.models import Transcription

pytestmark = pytest.mark.django_db
URL = "/api/transcriptions"


@pytest.fixture
def api(settings):
    settings.APP_PASSCODE = "secret"
    client = APIClient()
    client.credentials(HTTP_X_PASSCODE="secret")
    return client


def test_passcode_required(api):
    assert APIClient().get(URL).status_code == 403
    bad = APIClient()
    bad.credentials(HTTP_X_PASSCODE="nope")
    assert bad.get(URL).status_code == 403


def test_crud(api):
    made = api.post(URL, {"title": "Note", "text": "मैं office जा रहा हूँ"}, format="json")
    assert made.status_code == 201
    one = f"{URL}/{made.json()['id']}"
    segment = api.get(one).json()["segments"][0]

    assert api.patch(one, {"title": "New"}, format="json").json()["title"] == "New"
    seg_url = f"{one}/segments/{segment['id']}"
    edited = api.patch(seg_url, {"text": "edited", "original_text": "x"}, format="json").json()
    assert edited["text"] == "edited"
    assert edited["original_text"] == "मैं office जा रहा हूँ"

    assert api.delete(one).status_code == 204
    assert api.get(one).status_code == 404


def test_validation_and_read_only(api):
    item = Transcription.objects.create(title="A")
    one = f"{URL}/{item.id}"
    assert api.patch(one, {"title": ""}, format="json").status_code == 400
    api.patch(one, {"status": "recording"}, format="json")
    item.refresh_from_db()
    assert item.status == "completed"


def test_search_and_pagination(api):
    for i in range(12):
        item = Transcription.objects.create(title=f"T{i}")
        for seq in (1, 2):
            item.segments.create(seq=seq, text="नमस्ते world", original_text="x")
    page = api.get(URL).json()
    assert page["count"] == 12 and len(page["results"]) == 10
    assert page["results"][0]["preview"] == "नमस्ते world"
    assert api.get(URL, {"search": "नमस्ते"}).json()["count"] == 12  # no duplicates
    assert api.get(URL, {"search": "T11"}).json()["count"] == 1


def test_segment_must_belong_to_transcription(api):
    a, b = (Transcription.objects.create(title=t) for t in "ab")
    seg = a.segments.create(seq=1, text="x", original_text="x")
    r = api.patch(f"{URL}/{b.id}/segments/{seg.id}", {"text": "y"}, format="json")
    assert r.status_code == 404
