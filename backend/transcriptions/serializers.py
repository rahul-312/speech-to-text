from django.db import transaction
from rest_framework import serializers

from .models import Segment, Transcription


class SegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Segment
        fields = ["id", "seq", "text", "original_text", "start_ms", "end_ms"]
        read_only_fields = ["seq", "original_text", "start_ms", "end_ms"]


class TranscriptionListSerializer(serializers.ModelSerializer):
    preview = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = Transcription
        fields = [
            "id", "title", "status", "duration_ms", "created_at", "updated_at", "preview",
        ]  # fmt: skip


class TranscriptionSerializer(serializers.ModelSerializer):
    segments = SegmentSerializer(many=True, read_only=True)
    text = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Transcription
        fields = [
            "id", "title", "status", "duration_ms", "created_at", "updated_at",
            "segments", "text",
        ]  # fmt: skip
        read_only_fields = ["status", "duration_ms"]

    @transaction.atomic
    def create(self, validated_data):
        text = validated_data.pop("text", "").strip()
        item = super().create(validated_data)
        if text:
            item.segments.create(seq=1, text=text, original_text=text)
        return item

    def update(self, instance, validated_data):
        validated_data.pop("text", None)  # text is edited per segment
        return super().update(instance, validated_data)
