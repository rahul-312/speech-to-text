from django.contrib import admin

from .models import Segment, Transcription


class SegmentInline(admin.TabularInline):
    model = Segment
    extra = 0


@admin.register(Transcription)
class TranscriptionAdmin(admin.ModelAdmin):
    list_display = ["title", "status", "duration_ms", "created_at"]
    list_filter = ["status"]
    search_fields = ["title", "segments__text"]
    inlines = [SegmentInline]
