from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text

from app.db.database import Base


class Resource(Base):
    __tablename__ = "resources"

    id = Column(String(24), primary_key=True, default=lambda: f"res-{uuid4().hex[:8]}")
    resource_type = Column(String(30), nullable=False, index=True)
    # food | water | medical | shelter | rescue_team | vehicle | volunteer
    name = Column(String(200), nullable=False)
    description = Column(Text)
    quantity = Column(Integer, nullable=False, default=1)
    unit = Column(String(30), default="units")  # litres, kg, persons, vehicles …
    status = Column(String(30), nullable=False, default="available", index=True)
    # available | deployed | reserved | maintenance | depleted
    owner_org = Column(String(200))
    contact = Column(String(100))
    lat = Column(Float)
    lng = Column(Float)
    location_name = Column(String(300))
    assigned_incident_id = Column(String(24), index=True)
    deployment_notes = Column(Text)
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
    tags = Column(JSON)  # e.g. ["mobile", "heavy-duty"]
