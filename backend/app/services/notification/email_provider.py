"""Email notification provider.

Mock mode: logs to console with full email body.
Live mode: configure EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS.
"""
from __future__ import annotations
import logging
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

MOCK_RECIPIENTS = [
    "emergency@nairobi.go.ke",
    "response@kenyaredcross.org",
    "ndma@ndma.go.ke",
]

CHANNEL = "email"


class EmailProvider:
    """Send email alerts via SMTP (mock when not configured)."""

    @property
    def is_live(self) -> bool:
        return bool(getattr(settings, "EMAIL_SMTP_HOST", ""))

    def send(
        self,
        alert: dict,
        recipients: Optional[List[str]] = None,
    ) -> str:
        recipients = recipients or MOCK_RECIPIENTS
        subject = f"[SENTINEL AI] {alert.get('title', 'Emergency Alert')}"
        body = self._build_body(alert)

        if self.is_live:
            return self._send_live(subject, body, recipients, alert)
        return self._send_mock(subject, body, recipients, alert)

    def _build_body(self, alert: dict) -> str:
        actions = alert.get("recommended_actions") or []
        evacuation = alert.get("evacuation_guidance") or ""
        public_msg = alert.get("public_safety_message") or ""
        lines = [
            f"SENTINEL AI EMERGENCY ALERT",
            f"{'=' * 50}",
            f"Title:    {alert.get('title', '')}",
            f"Severity: {alert.get('severity', '').upper()}",
            f"Category: {alert.get('category', '')}",
            f"Areas:    {', '.join(alert.get('affected_areas') or [])}",
            f"",
            f"ALERT DETAILS",
            f"{alert.get('message_en', '')}",
        ]
        if actions:
            lines += ["", "RECOMMENDED ACTIONS:"] + [f"  {i+1}. {a}" for i, a in enumerate(actions)]
        if evacuation:
            lines += ["", "EVACUATION GUIDANCE:", f"  {evacuation}"]
        if public_msg:
            lines += ["", "PUBLIC SAFETY MESSAGE:", f"  {public_msg}"]
        lines += ["", f"Alert ID: {alert.get('id', '')}", f"Source: {alert.get('source', '')}"]
        return "\n".join(lines)

    def _send_mock(self, subject: str, body: str, recipients: List[str], alert: dict) -> str:
        logger.info(
            "EMAIL [MOCK] → %d recipient(s) | Subject: %s | Alert: %s",
            len(recipients),
            subject,
            alert.get("id", "?"),
        )
        return "mock_sent"

    def _send_live(self, subject: str, body: str, recipients: List[str], alert: dict) -> str:
        try:
            import smtplib
            from email.mime.text import MIMEText
            host = getattr(settings, "EMAIL_SMTP_HOST", "")
            port = int(getattr(settings, "EMAIL_SMTP_PORT", 587))
            user = getattr(settings, "EMAIL_SMTP_USER", "")
            pwd = getattr(settings, "EMAIL_SMTP_PASS", "")
            sender = getattr(settings, "EMAIL_FROM", user)
            msg = MIMEText(body, "plain")
            msg["Subject"] = subject
            msg["From"] = sender
            msg["To"] = ", ".join(recipients)
            with smtplib.SMTP(host, port) as server:
                server.starttls()
                server.login(user, pwd)
                server.sendmail(sender, recipients, msg.as_string())
            logger.info("Email sent to %d recipients for alert %s", len(recipients), alert.get("id"))
            return "sent"
        except Exception as exc:
            logger.error("Email delivery failed: %s", exc)
            return "failed"


email_provider = EmailProvider()
