"""Test settings. Set TEST_DATABASE_URL to run against Postgres; default is SQLite."""

import os

# Set before importing settings so .env can never point tests at a real database.
os.environ["DEBUG"] = "1"
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "")
os.environ["GEMINI_API_KEY"] = ""

from .settings import *  # noqa: E402, F403
