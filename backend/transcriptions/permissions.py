import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


def passcode_ok(value) -> bool:
    # Settings refuse to start with an empty passcode unless DEBUG=1.
    if not settings.APP_PASSCODE:
        return True
    return isinstance(value, str) and hmac.compare_digest(
        value.encode(), settings.APP_PASSCODE.encode()
    )


class HasPasscode(BasePermission):
    message = "Invalid passcode."

    def has_permission(self, request, view):
        return passcode_ok(request.headers.get("X-Passcode", ""))
