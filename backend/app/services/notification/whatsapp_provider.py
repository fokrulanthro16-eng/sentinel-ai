"""WhatsApp notification provider.

Mock mode: logs to console with formatted message.
Live mode: configure WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (Meta Cloud API).
"""
from __future__ import annotations
import logging
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

MOCK_RECIPIENTS = [
    "+254700112233",   # Kenya Red Cross WhatsApp
    "+254711223344",   # Nairobi County Emergency
]

CHANNEL = "whatsapp"

SEV_EMOJI = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}


class WhatsAppProvider:
    """Send WhatsApp alerts via Meta Cloud API (mock when not configured)."""

    @property
    def is_live(self) -> bool:
        return bool(getattr(settings, "WHATSAPP_TOKEN", ""))

    def send(
        self,
        alert: dict,
        recipients: Optional[List[str]] = None,
    ) -> str:
        recipients = recipients or MOCK_RECIPIENTS
        sev = alert.get("severity", "medium")
        emoji = SEV_EMOJI.get(sev, "⚠️")
        msg = (
            f"{emoji} *SENTINEL AI EMERGENCY ALERT*\n\n"
            f"*{alert.get('title', 'Emergency Alert')}*\n\n"
            f"{alert.get('message_en', '')}\n\n"
            f"📍 Areas: {', '.join(alert.get('affected_areas') or [])}\n"
            f"⚡ Severity: {sev.upper()}"
        )
        actions = alert.get("recommended_actions") or []
        if actions:
            msg += "\n\n*Actions Required:*\n" + "\n".join(f"• {a}" for a in actions[:3])

        if self.is_live:
            return self._send_live(msg, recipients, alert)
        return self._send_mock(msg, recipients, alert)

    def _send_mock(self, msg: str, recipients: List[str], alert: dict) -> str:
        logger.info(
            "WHATSAPP [MOCK] → %d recipient(s) | Alert: %s | Msg: %s…",
            len(recipients),
            alert.get("id", "?"),
            msg[:80],
        )
        return "mock_sent"

    def _send_live(self, msg: str, recipients: List[str], alert: dict) -> str:
        try:
            import httpx
            token = getattr(settings, "WHATSAPP_TOKEN", "")
            phone_id = getattr(settings, "WHATSAPP_PHONE_ID", "")
            url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
            headers = {"Authorization": f"Bearer {token}"}
            for number in recipients:
                httpx.post(
                    url,
                    headers=headers,
                    json={
                        "messaging_product": "whatsapp",
                        "to": number.replace("+", ""),
                        "type": "text",
                        "text": {"body": msg},
                    },
                    timeout=10,
                )
            logger.info("WhatsApp sent to %d recipients for alert %s", len(recipients), alert.get("id"))
            return "sent"
        except Exception as exc:
            logger.error("WhatsApp delivery failed: %s", exc)
            return "failed"


whatsapp_provider = WhatsAppProvider()
