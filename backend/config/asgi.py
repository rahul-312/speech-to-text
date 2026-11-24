import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
http_app = get_asgi_application()  # must run before importing app code

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.urls import path  # noqa: E402

from transcriptions.consumers import TranscribeConsumer  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": http_app,
        "websocket": AllowedHostsOriginValidator(
            URLRouter([path("ws/transcribe", TranscribeConsumer.as_asgi())])
        ),
    }
)
