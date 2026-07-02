"""Runtime AI provider settings — held in memory, bootstrapped from .env.

The raw `api_key` is stored server-side only and never serialised to the
frontend.  Callers outside this module should use `api_key_configured`
(bool) instead.

Settings reset to .env defaults on server restart.  For persistence
across restarts, add DATABASE_URL and a settings table — outside scope
of this milestone.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

AI_PROVIDERS = ("mock", "gemini", "openai", "anthropic", "ollama", "lmstudio")

_DEFAULT_MODELS: dict[str, str] = {
    "mock":      "",
    "gemini":    "gemini-1.5-flash",
    "openai":    "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
    "ollama":    "llama3",
    "lmstudio":  "local-model",
}

_DEFAULT_BASE_URLS: dict[str, str] = {
    "ollama":   "http://localhost:11434",
    "lmstudio": "http://localhost:1234/v1",
}


@dataclass
class AISettings:
    provider: str = "mock"
    model: str = ""
    api_key: str = ""    # server-side only — never returned to the frontend
    base_url: str = ""   # used by Ollama / LM Studio


_state: Optional[AISettings] = None


def _bootstrap() -> AISettings:
    """Derive initial settings from environment variables."""
    from app.core.config import settings as cfg

    if cfg.GEMINI_API_KEY:
        return AISettings(
            provider="gemini",
            model=cfg.GEMINI_MODEL or _DEFAULT_MODELS["gemini"],
            api_key=cfg.GEMINI_API_KEY,
        )
    return AISettings()   # defaults to mock


def get_ai_settings() -> AISettings:
    global _state
    if _state is None:
        _state = _bootstrap()
        logger.info("AI settings initialised — provider=%s", _state.provider)
    return _state


def update_ai_settings(
    *,
    provider: str,
    model: str,
    api_key: str,      # empty string = keep the existing key unchanged
    base_url: str,
) -> AISettings:
    global _state
    current = get_ai_settings()
    _state = AISettings(
        provider=provider,
        model=model.strip() or _DEFAULT_MODELS.get(provider, ""),
        api_key=api_key.strip() if api_key.strip() else current.api_key,
        base_url=base_url.strip() or _DEFAULT_BASE_URLS.get(provider, ""),
    )
    logger.info(
        "AI settings updated — provider=%s  model=%s",
        _state.provider,
        _state.model,
    )
    return _state
