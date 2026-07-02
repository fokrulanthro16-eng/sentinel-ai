"""AI provider settings endpoints.

GET  /api/ai/settings  → current provider config (api_key masked as bool)
POST /api/ai/settings  → update provider, model, key, base_url
POST /api/ai/test      → probe the currently-configured provider
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai_settings_store import AI_PROVIDERS, get_ai_settings, update_ai_settings
from app.services.ai_provider import test_connection

router = APIRouter(prefix="/api/ai", tags=["ai-settings"])


class AISettingsIn(BaseModel):
    provider: str
    model: str = ""
    api_key: str = ""     # empty = keep the existing key unchanged
    base_url: str = ""


class AISettingsOut(BaseModel):
    provider: str
    model: str
    api_key_configured: bool   # raw key never leaves the backend
    base_url: str
    providers: list


@router.get("/settings", response_model=AISettingsOut)
async def read_settings():
    s = get_ai_settings()
    return AISettingsOut(
        provider=s.provider,
        model=s.model,
        api_key_configured=bool(s.api_key),
        base_url=s.base_url,
        providers=list(AI_PROVIDERS),
    )


@router.post("/settings", response_model=AISettingsOut)
async def write_settings(body: AISettingsIn):
    if body.provider not in AI_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{body.provider}'. Valid: {', '.join(AI_PROVIDERS)}",
        )
    s = update_ai_settings(
        provider=body.provider,
        model=body.model,
        api_key=body.api_key,
        base_url=body.base_url,
    )
    return AISettingsOut(
        provider=s.provider,
        model=s.model,
        api_key_configured=bool(s.api_key),
        base_url=s.base_url,
        providers=list(AI_PROVIDERS),
    )


@router.post("/test")
async def test_ai_connection():
    return await test_connection()
