import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent
FRONTEND_DIST = PROJECT_DIR / "frontend" / "dist"
load_dotenv(PROJECT_DIR / ".env")

DEBUG = os.getenv("DEBUG", "0") == "1"
SECRET_KEY = os.getenv("SECRET_KEY") or ("dev-only-insecure-key" if DEBUG else "")
APP_PASSCODE = os.getenv("APP_PASSCODE", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DEBUG:
    for _name in ("SECRET_KEY", "APP_PASSCODE", "DATABASE_URL"):
        if not globals()[_name]:
            raise ImproperlyConfigured(f"{_name} must be set when DEBUG=0")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]
if os.getenv("RENDER_EXTERNAL_HOSTNAME"):  # set automatically by Render
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = not DEBUG

INSTALLED_APPS = [
    "daphne",  # first, so runserver handles WebSockets
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "channels",
    "transcriptions",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL or f"sqlite:///{BASE_DIR / 'dev.sqlite3'}"
    )
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
if FRONTEND_DIST.exists():
    WHITENOISE_ROOT = FRONTEND_DIST

REST_FRAMEWORK = {
    # Passcode header only: no cookies, so no CSRF exposure on the API.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["transcriptions.permissions.HasPasscode"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}
SPECTACULAR_SETTINGS = {"TITLE": "Speech to Text API", "VERSION": "1.0.0"}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-transcribe-live")
# Naming both languages keeps mixed speech in one script more often than auto-detect.
GEMINI_LANGUAGES = ["hi-IN", "en-IN"]
GEMINI_POLISH_MODEL = "gemini-3.5-transcribe"
POLISH_TIMEOUT_SECONDS = 20
# Gemini ends a live session at 10 minutes, so we stop earlier.
MAX_RECORDING_MS = 9 * 60 * 1000
MAX_CONCURRENT_RECORDINGS = 3
AUDIO_IDLE_SECONDS = 20
FLUSH_IDLE_SECONDS = 2.5
FLUSH_MAX_SECONDS = 8
