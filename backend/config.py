"""
PropFlow CRM — Centralised Configuration
Pydantic Settings validates ALL environment variables on startup.
Missing required vars → fail fast with clear error messages.
Missing optional vars → log warnings, features gracefully degrade.
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# Load .env BEFORE anything else so values are in os.environ
# ═══════════════════════════════════════════════════════════════════════════════
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


# ═══════════════════════════════════════════════════════════════════════════════
# Settings Model — validates every env var in one place
# ═══════════════════════════════════════════════════════════════════════════════
class Settings(BaseModel):
    """
    All environment variables for PropFlow CRM.
    Required fields raise on startup if blank/missing.
    Optional fields default to empty strings.
    """

    # ── Required ─────────────────────────────────────────────────────────────
    MONGO_URL: str
    DB_NAME: str
    JWT_SECRET: str
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str
    FRONTEND_URL: str

    # ── Optional: AI / LLM ──────────────────────────────────────────────────
    EMERGENT_LLM_KEY: str = ""

    # ── Optional: Email (Brevo) ─────────────────────────────────────────────
    BREVO_API_KEY: str = ""
    SENDER_EMAIL: str = ""
    SENDER_NAME: str = "PropFlow CRM"

    # ── Optional: SMS (Twilio) ──────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # ── Optional: Google Calendar OAuth ─────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── Optional: CORS override ─────────────────────────────────────────────
    CORS_ORIGINS: str = ""

    # ── Tunables ────────────────────────────────────────────────────────────
    MAX_AI_COST_PER_CALL: float = 0.05
    MAX_AI_CALLS_PER_HOUR: int = 20

    # ── Derived / computed ──────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.FRONTEND_URL.startswith("https://")

    # ── Validators ──────────────────────────────────────────────────────────
    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_min_length(cls, v: str) -> str:
        if len(v) < 16:
            raise ValueError("JWT_SECRET must be at least 16 characters for security")
        return v

    @field_validator("MONGO_URL")
    @classmethod
    def mongo_url_format(cls, v: str) -> str:
        if not v.startswith("mongodb"):
            raise ValueError("MONGO_URL must start with 'mongodb://' or 'mongodb+srv://'")
        return v

    @field_validator("FRONTEND_URL")
    @classmethod
    def frontend_url_format(cls, v: str) -> str:
        if not v.startswith("http"):
            raise ValueError("FRONTEND_URL must start with 'http://' or 'https://'")
        return v


# ═══════════════════════════════════════════════════════════════════════════════
# Instantiate & validate — fail fast on startup
# ═══════════════════════════════════════════════════════════════════════════════
def _load_settings() -> Settings:
    """Build Settings from os.environ and validate. Logs warnings for optional vars."""
    env = {}
    required_fields = {"MONGO_URL", "DB_NAME", "JWT_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "FRONTEND_URL"}
    optional_warnings = {
        "EMERGENT_LLM_KEY": "AI features (email drafting, lead scoring) will be unavailable",
        "BREVO_API_KEY": "Email sending via Brevo will be unavailable",
        "TWILIO_ACCOUNT_SID": "SMS sending via Twilio will be unavailable",
        "TWILIO_AUTH_TOKEN": "SMS sending via Twilio will be unavailable",
        "TWILIO_PHONE_NUMBER": "SMS sending via Twilio will be unavailable",
        "GOOGLE_CLIENT_ID": "Google Calendar sync will be unavailable",
        "GOOGLE_CLIENT_SECRET": "Google Calendar sync will be unavailable",
    }

    # Gather all fields from the model
    for field_name in Settings.model_fields:
        val = os.environ.get(field_name, "")
        if val:
            env[field_name] = val

    # Check required
    missing_required = [f for f in required_fields if not env.get(f)]
    if missing_required:
        raise RuntimeError(
            f"FATAL: Missing required environment variables: {', '.join(sorted(missing_required))}. "
            "Server cannot start. Check your .env file."
        )

    # Log optional warnings
    for var, warning in optional_warnings.items():
        if not env.get(var):
            logger.warning(f"Optional env var {var} not set — {warning}")

    try:
        return Settings(**env)
    except Exception as e:
        raise RuntimeError(f"FATAL: Environment variable validation failed:\n{e}") from e


settings = _load_settings()
