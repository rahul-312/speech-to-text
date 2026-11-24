from django.db.models import OuterRef, Subquery
from rest_framework import mixins, viewsets
from rest_framework.filters import SearchFilter

from .models import Segment, Transcription
from .serializers import (
    SegmentSerializer,
    TranscriptionListSerializer,
    TranscriptionSerializer,
)


class TranscriptionViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = Transcription.objects.all()
    filter_backends = [SearchFilter]
    search_fields = ["title", "segments__text"]

    def get_queryset(self):
        if self.action == "list":
            first = Segment.objects.filter(transcription=OuterRef("pk")).order_by("seq")
            return self.queryset.annotate(preview=Subquery(first.values("text")[:1]))
        return self.queryset.prefetch_related("segments")

    def get_serializer_class(self):
        if self.action == "list":
            return TranscriptionListSerializer
        return TranscriptionSerializer


class SegmentViewSet(
    mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    http_method_names = ["patch", "delete", "options"]
    serializer_class = SegmentSerializer
    queryset = Segment.objects.all()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return self.queryset.filter(transcription_id=self.kwargs["transcription_pk"])
