"""Audit log for trust score changes and status transitions."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text
from app.db.database import Base


class TrustAuditLog(Base):
    __tablename__ = "trust_audit_log"

    id = Column(String(40), primary_key=True, default=lambda: f"aud-{uuid4().hex[:8]}")
    incident_id = Column(
        String(20),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(50), nullable=False)   # trust_calculated|trust_recalculated|status_change|override
    actor = Column(String(200))                    # email or "system"
    previous_status = Column(String(20))
    new_status = Column(String(20))
    trust_score_before = Column(Float)
    trust_score_after = Column(Float)
    confidence_before = Column(String(30))
    confidence_after = Column(String(30))
    notes = Column(Text)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
