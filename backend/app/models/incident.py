"""SQLAlchemy ORM model for incidents."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text, Index
from sqlalchemy.sql import func

from app.db.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(20), primary_key=True, default=lambda: f"inc-{uuid4().hex[:6]}")
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    location_name = Column(String(200), nullable=False)
    reporter_name = Column(String(200))
    reporter_phone = Column(String(50))
    reporter_id = Column(String(100))        # Prisma User.id of submitter
    affected_count = Column(Integer)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    ai_category = Column(String(100))
    ai_confidence = Column(Float)
    verified = Column(Boolean, nullable=False, default=False)
    admin_notes = Column(Text)
    trust_score = Column(Float)
    confidence_level = Column(String(30))   # low|medium|high|verified_candidate
    validation_reasons = Column(JSON)        # list[str]

    __table_args__ = (
        Index("ix_incidents_severity", "severity"),
        Index("ix_incidents_status", "status"),
        Index("ix_incidents_reporter_id", "reporter_id"),
        Index("ix_incidents_timestamp", "timestamp"),
    )
