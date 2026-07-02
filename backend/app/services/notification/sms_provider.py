"""SMS notification provider.

Mock mode: logs to console and records delivery in the alert dict.
Live mode: configure SMS_GATEWAY_URL + SMS_API_KEY (e.g. Africa's Talking / Twilio).

To go live, set SMS_GATEWAY_URL and SMS_API_KEY in environment.
The mock provider records realistic delivery status so the UI behaves correctly.
"""
from __future__ import annotations
import logging
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Nairobi emergency contact numbers — mock recipients
MOCK_RECIPIENTS = [
    "+254700112233",   # Kenya Red Cross
    "+254711223344",   # Nairobi County Emergency
    "+254722334455",   # NDMA
]

CHANNEL = "sms"


class SMSProvider:
    """Send SMS alerts via configured gateway (mock when not configured)."""

    @property
    def is_live(self) -> bool:
        return bool(getattr(settings, "SMS_GATEWAY_URL", ""))

    def send(
        self,
        alert: dict,
        recipients: Optional[List[str]] = None,
    ) -> str:
        recipients = recipients or MOCK_RECIPIENTS
        msg = (
            f"[SENTINEL AI ALERT] {alert.get('title', 'Emergency Alert')}\n"
            f"{alert.get('message_en', '')[:160]}\n"
            f"Severity: {alert.get('severity', '?').upper()}"
        )

        if self.is_live:
            return self._send_live(msg, recipients, alert)
        return self._send_mock(msg, recipients, alert)

    def _send_mock(self, msg: str, recipients: List[str], alert: dict) -> str:
        logger.info(
            "SMS [MOCK] → %d recipient(s) | Alert: %s | Message: %s…",
            len(recipients),
            alert.get("id", "?"),
            msg[:80],
        )
        return "mock_sent"

    def _send_live(self, msg: str, recipients: List[str], alert: dict) -> str:
        try:
            import httpx
            url = getattr(settings, "SMS_GATEWAY_URL", "")
            key = getattr(settings, "SMS_API_KEY", "")
            resp = httpx.post(
                url,
                json={"message": msg, "to": recipients, "api_key": key},
                timeout=10,
            )
            resp.raise_for_status()
            logger.info("SMS sent to %d recipients for alert %s", len(recipients), alert.get("id"))
            return "sent"
        except Exception as exc:
            logger.error("SMS delivery failed: %s", exc)
            return "failed"


sms_provider = SMSProvider()
