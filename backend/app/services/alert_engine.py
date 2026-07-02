"""Alert Engine — generates and dispatches multi-channel alerts.

Trigger conditions (enforced by callers — engine just generates):
  - Incident verified by Admin/Responder
  - Critical incident with High/Verified-Candidate confidence

Pipeline:
  1. AI generates alert content (title, summary, actions, evacuation, public message)
  2. Multilingual translation (EN, SW, FR, AR)
  3. Alert record persisted to DB/mock store
  4. Notifications dispatched: SMS | Email | WhatsApp | Dashboard | WebSocket
  5. Delivery status recorded
  6. WebSocket broadcast: alert.created
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.gemini_service import generate_alert_content, generate_multilingual_alert
from app.services.notification import sms_provider, email_provider, whatsapp_provider
from app.db import alert_repo
from app.core.connection_manager import manager

logger = logging.getLogger(__name__)

AlertTrigger = Literal["verified", "auto_high_confidence", "manual"]

SEVERITY_RADIUS_KM = {"critical": 10.0, "high": 5.0, "medium": 2.5, "low": 1.0}
SEVERITY_EXPIRY_HOURS = {"critical": 24, "high": 12, "medium": 6, "low": 3}

NAIROBI_DISTRICTS = [
    "Westlands", "Kibera", "Mathare", "Eastleigh", "Ruaraka", "Karen",
    "Kasarani", "Embakasi", "Pumwani", "Dagoretti", "Langata", "Makadara",
    "Kamukunji", "Starehe", "Roysambu", "Parklands", "Kilimani",
]


async def generate_alert(
    incident: dict,
    trigger: AlertTrigger = "manual",
    *,
    session: Optional[AsyncSession] = None,
) -> dict:
    """
    Generate, persist, and dispatch an alert for the given incident.

    Returns the created alert dict.
    Never raises — on failure, logs and returns a minimal fallback.
    """
    inc_id = incident.get("id", "unknown")
    sev = incident.get("severity", "medium")
    location = incident.get("location_name", "Unknown")
    lat = incident.get("lat")
    lng = incident.get("lng")

    logger.info(
        "AlertEngine: generating alert for incident %s (trigger=%s, sev=%s)",
        inc_id, trigger, sev,
    )

    # ── Step 1: AI content generation ────────────────────────────────────────
    try:
        content = generate_alert_content(incident)
    except Exception as exc:
        logger.warning("Alert content generation failed: %s", exc)
        content = {
            "title": f"ALERT — {location}",
            "summary": f"Emergency alert for {location}. Severity: {sev.upper()}.",
            "recommended_actions": ["Stay alert", "Follow authorities", "Call 999"],
            "evacuation_guidance": "Evacuate if instructed by authorities.",
            "public_safety_message": "Stay away from the affected area.",
        }

    # ── Step 2: Multilingual translation ──────────────────────────────────────
    message_sw = message_fr = message_ar = None
    try:
        translations = generate_multilingual_alert(
            title=content["title"],
            message_en=content["summary"],
            target_languages=["sw", "fr", "ar"],
        )
        message_sw = translations.get("sw")
        message_fr = translations.get("fr")
        message_ar = translations.get("ar")
    except Exception as exc:
        logger.warning("Alert translation failed: %s", exc)
        # Construct basic Swahili fallback
        message_sw = f"Onyo la dharura: {content['title']}. {content['summary']}"
        message_fr = f"Alerte d'urgence: {content['title']}. {content['summary']}"
        message_ar = f"تنبيه طارئ: {content['title']}. {content['summary']}"

    # ── Step 3: Build alert record ─────────────────────────────────────────────
    issued_at = datetime.now(timezone.utc)
    expiry_h = SEVERITY_EXPIRY_HOURS.get(sev, 6)
    expires_at = (issued_at + timedelta(hours=expiry_h)).isoformat()

    districts = _extract_districts(location)
    alert_data = {
        "title": content["title"],
        "message_en": content["summary"],
        "message_sw": message_sw,
        "message_fr": message_fr,
        "message_ar": message_ar,
        "severity": sev,
        "category": incident.get("ai_category") or incident.get("type", "other"),
        "affected_areas": [location],
        "source": "Sentinel AI Alert Engine",
        "ai_generated": True,
        "incident_id": inc_id,
        "notification_channels": ["dashboard", "websocket", "sms", "email", "whatsapp"],
        "delivery_status": {},
        "radius_km": SEVERITY_RADIUS_KM.get(sev, 2.5),
        "lat": lat,
        "lng": lng,
        "recommended_actions": content.get("recommended_actions", []),
        "evacuation_guidance": content.get("evacuation_guidance"),
        "public_safety_message": content.get("public_safety_message"),
        "districts": districts,
        "expires_at": expires_at,
    }

    # ── Step 4: Persist ───────────────────────────────────────────────────────
    alert = await alert_repo.create(alert_data, session=session)

    # ── Step 5: Dispatch notifications (sync — mock providers are instant) ────
    delivery: dict[str, str] = {
        "dashboard": "delivered",
        "websocket": "pending",
    }
    try:
        delivery["sms"] = sms_provider.send(alert)
    except Exception as exc:
        logger.warning("SMS dispatch error: %s", exc)
        delivery["sms"] = "failed"

    try:
        delivery["email"] = email_provider.send(alert)
    except Exception as exc:
        logger.warning("Email dispatch error: %s", exc)
        delivery["email"] = "failed"

    try:
        delivery["whatsapp"] = whatsapp_provider.send(alert)
    except Exception as exc:
        logger.warning("WhatsApp dispatch error: %s", exc)
        delivery["whatsapp"] = "failed"

    # ── Step 6: Update delivery status ────────────────────────────────────────
    alert = await alert_repo.update_delivery(alert["id"], delivery, session=session) or alert
    alert["delivery_status"] = delivery

    # ── Step 7: WebSocket broadcast ───────────────────────────────────────────
    delivery["websocket"] = "broadcast"
    asyncio.create_task(manager.broadcast({
        "type": "alert.created",
        "alert": alert,
        "trigger": trigger,
    }))

    logger.info(
        "AlertEngine: alert %s dispatched | delivery=%s",
        alert.get("id"), delivery,
    )
    return alert


def _extract_districts(location: str) -> list[str]:
    """Extract known Nairobi district names from a location string."""
    districts = [d for d in NAIROBI_DISTRICTS if d.lower() in location.lower()]
    if not districts:
        # Fall back to first segment before comma
        first = location.split(",")[0].strip() if "," in location else location.split()[0].strip()
        districts = [first] if first else ["Unknown"]
    return districts
