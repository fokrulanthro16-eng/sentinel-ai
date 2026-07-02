"""SQLAlchemy ORM model for alerts."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, JSON, String, Text
from app.db.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(20), primary_key=True, default=lambda: f"alrt-{uuid4().hex[:6]}")
    title = Column(String(200), nullable=False)
    message_en = Column(Text, nullable=False)
    message_sw = Column(Text)
    message_fr = Column(Text)
    message_ar = Column(Text)
    severity = Column(String(20), nullable=False)
    category = Column(String(100), nullable=False)
    issued_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = Column(DateTime(timezone=True))
    affected_areas = Column(JSON)           # list[str]
    source = Column(String(200), nullable=False, default="Sentinel AI System")
    ai_generated = Column(Boolean, nullable=False, default=False)
    active = Column(Boolean, nullable=False, default=True)
    incident_id = Column(String(20))        # incident that triggered this alert
    notification_channels = Column(JSON)    # list[str]: sms|email|whatsapp|dashboard|websocket
    delivery_status = Column(JSON)          # dict[str, str]: channel → sent|mock_sent|failed
    radius_km = Column(Float)              # alert broadcast radius
    lat = Column(Float)                    # incident location (for map radius)
    lng = Column(Float)
    recommended_actions = Column(JSON)     # list[str]
    evacuation_guidance = Column(Text)
    public_safety_message = Column(Text)
    districts = Column(JSON)               # list[str]
