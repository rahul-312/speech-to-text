from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny


def health(_request):
    return JsonResponse({"status": "ok"})


def spa(_request):
    """Serve the React app for every non-API path (client-side routing)."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse("Frontend not built: run `npm run build`.", status=404)
    return HttpResponse(index.read_bytes(), headers={"Cache-Control": "no-cache"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/schema", SpectacularAPIView.as_view(permission_classes=[AllowAny]), name="schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]),
    ),
    path("api/", include("transcriptions.urls")),
    re_path(r"^(?!api/|ws/|static/|assets/|admin/).*$", spa),
]
