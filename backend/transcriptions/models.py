import uuid

from django.db import models


class Transcription(models.Model):
    class Status(models.TextChoices):
        RECORDING = "recording"
        COMPLETED = "completed"
        INTERRUPTED = "interrupted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.COMPLETED
    )
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]

    def __str__(self):
        return self.title


class Segment(models.Model):
    transcription = models.ForeignKey(
        Transcription, on_delete=models.CASCADE, related_name="segments"
    )
    seq = models.PositiveIntegerField()
    text = models.TextField()
    original_text = models.TextField(help_text="What the engine produced; never edited")
    start_ms = models.PositiveIntegerField(default=0)
    end_ms = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["seq"]
        constraints = [
            models.UniqueConstraint(
                fields=["transcription", "seq"], name="unique_segment_seq"
            )
        ]

    def __str__(self):
        return self.text[:60]
