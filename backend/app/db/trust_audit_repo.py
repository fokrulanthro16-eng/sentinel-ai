"""Trust Audit Log CRUD — DB / mock dual-mode."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import db_enabled

# In-memory audit log for mock mode
_mock_audit: List[dict] = []


def _entry_id() -> str:
    return f"aud-{uuid4().hex[:8]}"


async def log_action(
    *,
    incident_id: str,
    action: str,
    actor: Optional[str] = "system",
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None,
    trust_score_before: Optional[float] = None,
    trust_score_after: Optional[float] = None,
    confidence_before: Optional[str] = None,
    confidence_after: Optional[str] = None,
    notes: Optional[str] = None,
    session: Optional[AsyncSession] = None,
) -> dict:
    entry = {
        "id": _entry_id(),
        "incident_id": incident_id,
        "action": action,
        "actor": actor,
        "previous_status": previous_status,
        "new_status": new_status,
        "trust_score_before": trust_score_before,
        "trust_score_after": trust_score_after,
        "confidence_before": confidence_before,
        "confidence_after": confidence_after,
        "notes": notes,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if not db_enabled() or session is None:
        _mock_audit.append(entry)
        return entry

    from app.models.trust_audit_log import TrustAuditLog
    row = TrustAuditLog(**{k: v for k, v in entry.items() if k != "timestamp"})
    row.timestamp = datetime.now(timezone.utc)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_dict(row)


async def get_for_incident(
    incident_id: str,
    *,
    session: Optional[AsyncSession] = None,
    limit: int = 50,
) -> List[dict]:
    if not db_enabled() or session is None:
        entries = [e for e in _mock_audit if e["incident_id"] == incident_id]
        return sorted(entries, key=lambda e: e["timestamp"], reverse=True)[:limit]

    from app.models.trust_audit_log import TrustAuditLog
    stmt = (
        select(TrustAuditLog)
        .where(TrustAuditLog.incident_id == incident_id)
        .order_by(TrustAuditLog.timestamp.desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [_row_to_dict(r) for r in rows]


def _row_to_dict(row) -> dict:
    return {
        "id": row.id,
        "incident_id": row.incident_id,
        "action": row.action,
        "actor": row.actor,
        "previous_status": row.previous_status,
        "new_status": row.new_status,
        "trust_score_before": row.trust_score_before,
        "trust_score_after": row.trust_score_after,
        "confidence_before": getattr(row, "confidence_before", None),
        "confidence_after": getattr(row, "confidence_after", None),
        "notes": row.notes,
        "timestamp": row.timestamp.isoformat() if hasattr(row.timestamp, "isoformat") else row.timestamp,
    }
