from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import SegmentViewSet, TranscriptionViewSet

router = SimpleRouter(trailing_slash=False)
router.register("transcriptions", TranscriptionViewSet)

urlpatterns = router.urls + [
    path(
        "transcriptions/<uuid:transcription_pk>/segments/<int:pk>",
        SegmentViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
    ),
]
