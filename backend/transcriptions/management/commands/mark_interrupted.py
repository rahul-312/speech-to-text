from django.core.management.base import BaseCommand

from transcriptions.models import Transcription


class Command(BaseCommand):
    help = "Mark recordings left open by a crash or restart as interrupted."

    def handle(self, *args, **options):
        status = Transcription.Status
        n = Transcription.objects.filter(status=status.RECORDING).update(
            status=status.INTERRUPTED
        )
        self.stdout.write(f"Marked {n} recording(s) interrupted")
