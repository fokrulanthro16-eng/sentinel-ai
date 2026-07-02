from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.db.database import Base


class ResourceRequest(Base):
    __tablename__ = "resource_requests"

    id = Column(String(24), primary_key=True, default=lambda: f"req-{uuid4().hex[:8]}")
    # Who requested
    requester_name = Column(String(200), nullable=False)
    requester_phone = Column(String(50))
    requester_location = Column(String(300))
    lat = Column(Float)
    lng = Column(Float)
    # What they need
    category = Column(String(30), nullable=False, index=True)
    # food | water | medical | shelter | rescue | other
    quantity_needed = Column(Integer, default=1)
    description = Column(Text, nullable=False)
    # Priority / linkage
    incident_id = Column(String(24), index=True)   # optional link to verified incident
    urgency = Column(String(20), nullable=False, default="medium", index=True)
    # critical | high | medium | low — auto-elevated when linked to high-trust incident
    # Fulfilment
    status = Column(String(30), nullable=False, default="pending", index=True)
    # pending | acknowledged | in_progress | fulfilled | cancelled
    fulfilled_by_resource_id = Column(String(24))
    responder_notes = Column(Text)
    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    fulfilled_at = Column(DateTime(timezone=True))
