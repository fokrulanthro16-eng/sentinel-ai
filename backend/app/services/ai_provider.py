"""Unified AI provider dispatcher.

Routes all AI calls to whichever backend is selected in ai_settings_store.
On provider failure the functions raise RuntimeError — route handlers turn
these into HTTP 503 responses so errors surface clearly.

Supported providers
-------------------
mock      – structured mock responses (no network calls)
gemini    – Google Gemini via google-generativeai SDK (sync, run in thread)
openai    – OpenAI Chat Completions (httpx async)
anthropic – Anthropic Messages API (httpx async)
ollama    – Ollama local AI, OpenAI-compatible endpoint (httpx async)
lmstudio  – LM Studio local AI, OpenAI-compatible endpoint (httpx async)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import httpx

from app.services.ai_settings_store import AISettings, get_ai_settings

logger = logging.getLogger(__name__)


# ── JSON helpers ───────────────────────────────────────────────────────────────

def _safe_json(text: str) -> Any:
    """Strip markdown code fences then parse JSON."""
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            inner = parts[1]
            if inner.startswith("json"):
                inner = inner[4:]
            text = inner
    brace   = text.find("{")
    bracket = text.find("[")
    start = min(
        brace   if brace   >= 0 else len(text),
        bracket if bracket >= 0 else len(text),
    )
    if start > 0:
        text = text[start:]
    return json.loads(text.strip())


# ── Low-level provider calls ───────────────────────────────────────────────────

def _gemini_sync(prompt: str, api_key: str, model: str) -> str:
    """Synchronous Gemini call — run via asyncio.to_thread to avoid blocking."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    m = genai.GenerativeModel(model or "gemini-1.5-flash")
    return m.generate_content(prompt).text


async def _call_gemini(prompt: str, s: AISettings) -> str:
    if not s.api_key:
        raise RuntimeError("Gemini API key not configured")
    try:
        return await asyncio.to_thread(_gemini_sync, prompt, s.api_key, s.model)
    except Exception as exc:
        raise RuntimeError(f"Gemini: {exc}") from exc


async def _call_openai_compat(prompt: str, s: AISettings) -> str:
    """Covers openai, ollama, and lmstudio (all OpenAI-compatible chat APIs)."""
    if s.provider == "openai":
        if not s.api_key:
            raise RuntimeError("OpenAI API key not configured")
        url = "https://api.openai.com/v1/chat/completions"
        headers: dict[str, str] = {
            "Authorization": f"Bearer {s.api_key}",
            "Content-Type": "application/json",
        }
        model = s.model or "gpt-4o-mini"

    elif s.provider == "ollama":
        base = (s.base_url or "http://localhost:11434").rstrip("/")
        url = f"{base}/v1/chat/completions"
        headers = {"Content-Type": "application/json"}
        model = s.model or "llama3"

    else:  # lmstudio
        base = (s.base_url or "http://localhost:1234/v1").rstrip("/")
        if not base.endswith("/v1"):
            base += "/v1"
        url = f"{base}/chat/completions"
        headers = {"Content-Type": "application/json"}
        model = s.model or "local-model"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"{s.provider} HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"{s.provider}: {exc}") from exc


async def _call_anthropic(prompt: str, s: AISettings) -> str:
    if not s.api_key:
        raise RuntimeError("Anthropic API key not configured")
    payload = {
        "model": s.model or "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": s.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"]
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"Anthropic HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Anthropic: {exc}") from exc


async def _dispatch(prompt: str) -> str:
    """Route prompt to the configured provider. Raises RuntimeError on failure."""
    s = get_ai_settings()
    if s.provider == "gemini":
        return await _call_gemini(prompt, s)
    if s.provider in ("openai", "ollama", "lmstudio"):
        return await _call_openai_compat(prompt, s)
    if s.provider == "anthropic":
        return await _call_anthropic(prompt, s)
    raise RuntimeError("mock")   # sentinel — callers handle this branch


# ── Public AI functions (same signatures as gemini_service.py) ─────────────────

async def classify_incident(description: str, location: str = "") -> dict:
    from app.services import gemini_service as _gs

    s = get_ai_settings()
    if s.provider == "mock":
        return _gs.classify_incident(description, location)

    prompt = f"""\
You are an emergency management AI. Classify this incident report.
Description: "{description}"
Location: "{location}"
Return ONLY valid JSON:
{{
  "category": "<concise incident category>",
  "severity": "<critical | high | medium | low>",
  "confidence": <float 0.0-1.0>,
  "summary": "<one sentence classification rationale>",
  "keywords": ["<kw1>", "<kw2>", "<kw3>"]
}}"""
    try:
        return _safe_json(await _dispatch(prompt))
    except Exception as exc:
        logger.warning("classify_incident [%s] failed: %s", s.provider, exc)
        raise RuntimeError(str(exc))


async def generate_multilingual_alert(
    title: str,
    message_en: str,
    target_languages: list[str] | None = None,
) -> dict:
    from app.services import gemini_service as _gs

    s = get_ai_settings()
    if s.provider == "mock":
        return _gs.generate_multilingual_alert(title, message_en, target_languages)

    if target_languages is None:
        target_languages = ["sw", "fr", "ar"]
    lang_names = {"sw": "Swahili", "fr": "French", "ar": "Arabic", "es": "Spanish"}
    langs_str = ", ".join(f"{lang_names.get(l, l)} ({l})" for l in target_languages)

    prompt = f"""\
Translate this emergency alert into: {langs_str}
Title: "{title}"
Message: "{message_en}"
Return ONLY valid JSON:
{{
  "en": "{message_en}",
  {", ".join(f'"{l}": "<{lang_names.get(l, l)} translation>"' for l in target_languages)}
}}"""
    try:
        result = _safe_json(await _dispatch(prompt))
        result["en"] = message_en
        return result
    except Exception as exc:
        logger.warning("multilingual_alert [%s] failed: %s", s.provider, exc)
        return {"en": message_en}   # graceful degradation for non-critical path


async def get_action_recommendations(incidents: list[dict]) -> dict:
    from app.services import gemini_service as _gs

    s = get_ai_settings()
    if s.provider == "mock":
        return _gs.get_action_recommendations(incidents)

    summary = "\n".join(
        f"- [{i.get('severity','?').upper()}] {i.get('title','?')}: {i.get('description','')[:120]}"
        for i in incidents[:10]
    )
    prompt = f"""\
You are an emergency response coordinator AI.
Active incidents:
{summary}
Return ONLY valid JSON:
{{
  "priority_actions": [
    {{
      "priority": 1,
      "action": "<action title>",
      "rationale": "<one sentence reason>",
      "agencies": ["<agency>"],
      "timeframe": "<Immediate | Within 1 hour | Within 6 hours>"
    }}
  ],
  "resource_needs": ["<resource>"],
  "coordination_notes": "<2-3 sentence overview>"
}}"""
    try:
        return _safe_json(await _dispatch(prompt))
    except Exception as exc:
        logger.warning("action_recommendations [%s] failed: %s", s.provider, exc)
        return _gs.get_action_recommendations(incidents)


async def generate_risk_summary(incidents: list[dict], alerts: list[dict]) -> dict:
    from app.services import gemini_service as _gs

    s = get_ai_settings()
    if s.provider == "mock":
        return _gs.generate_risk_summary(incidents, alerts)

    from datetime import datetime, timezone

    active_critical = sum(1 for i in incidents if i.get("severity") == "critical")
    active_high     = sum(1 for i in incidents if i.get("severity") == "high")
    total_affected  = sum(i.get("affected_count") or 0 for i in incidents)
    incident_text   = "\n".join(
        f"- [{i.get('severity','?').upper()}] {i.get('title','?')} @ {i.get('location_name','?')}"
        for i in incidents
    )
    alert_text = "\n".join(f"- {a.get('title','?')}" for a in alerts)

    prompt = f"""\
Generate a situation report (SITREP) for emergency authorities.
Summary: {len(incidents)} incidents ({active_critical} critical, {active_high} high), ~{total_affected:,} affected, {len(alerts)} active alerts.
Incidents:
{incident_text}
Alerts:
{alert_text}
Return ONLY valid JSON:
{{
  "overall_risk_level": "<CRITICAL | HIGH | MEDIUM | LOW>",
  "executive_summary": "<3-4 sentences>",
  "key_threats": ["<threat1>", "<threat2>"],
  "population_at_risk": <integer>,
  "incident_hotspots": ["<area1>", "<area2>"],
  "forecast": "<2-3 sentence outlook>",
  "immediate_priorities": ["<priority1>", "<priority2>"],
  "generated_at": "<ISO timestamp>"
}}"""
    try:
        result = _safe_json(await _dispatch(prompt))
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        return result
    except Exception as exc:
        logger.warning("risk_summary [%s] failed: %s", s.provider, exc)
        return _gs.generate_risk_summary(incidents, alerts)


async def test_connection() -> dict:
    """Probe the configured provider with a minimal request."""
    s = get_ai_settings()

    if s.provider == "mock":
        return {
            "success": True,
            "provider": "mock",
            "model": "built-in",
            "latency_ms": 0,
            "message": "Mock AI is always available — no external calls needed.",
        }

    t0 = time.monotonic()
    try:
        text = await _dispatch("Reply with exactly the word: OK")
        ms = int((time.monotonic() - t0) * 1000)
        return {
            "success": True,
            "provider": s.provider,
            "model": s.model,
            "latency_ms": ms,
            "message": f"Connected. Response preview: {text[:80].strip()}",
        }
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        return {
            "success": False,
            "provider": s.provider,
            "model": s.model,
            "latency_ms": ms,
            "error": str(exc),
        }
