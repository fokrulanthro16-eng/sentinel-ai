"""Repository — Incident CRUD with automatic DB / mock fallback.

All public functions accept an optional `session` parameter.
When session is None (mock mode) they delegate to mock_data.py.
When session is an AsyncSession they use SQLAlchemy.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import func, or_, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.mock_data as mock
from app.db.database import db_enabled


# ── Public API ────────────────────────────────────────────────────────────────

async def list_incidents(
    *,
    session: Optional[AsyncSession] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    incident_type: Optional[str] = None,
    page: int = 1,
    per_page: int = 200,
    sort_by: str = "timestamp",
    sort_dir: str = "desc",
) -> Tuple[List[dict], int]:
    """Returns (items, total_count)."""
    if not db_enabled() or session is None:
        return _mock_list(
            severity=severity, status=status, search=search,
            incident_type=incident_type, page=page, per_page=per_page,
            sort_by=sort_by, sort_dir=sort_dir,
        )
    return await _db_list(
        session=session, severity=severity, status=status, search=search,
        incident_type=incident_type, page=page, per_page=per_page,
        sort_by=sort_by, sort_dir=sort_dir,
    )


async def get_by_id(
    incident_id: str, *, session: Optional[AsyncSession] = None
) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.get_incident_by_id(incident_id)
    from app.models.incident import Incident
    row = (
        await session.execute(select(Incident).where(Incident.id == incident_id))
    ).scalar_one_or_none()
    return _to_dict(row) if row else None


async def create(data: dict, *, session: Optional[AsyncSession] = None) -> dict:
    if not db_enabled() or session is None:
        return mock.create_incident({**data, "status": "pending"})
    from app.models.incident import Incident
    _allowed = {
        "type", "title", "description", "severity", "lat", "lng", "location_name",
        "reporter_name", "reporter_phone", "reporter_id", "affected_count",
        "ai_category", "ai_confidence",
        "trust_score", "confidence_level", "validation_reasons",
    }
    row = Incident(
        id=f"inc-{uuid4().hex[:6]}",
        timestamp=datetime.now(timezone.utc),
        verified=False,
        status="pending",
        **{k: v for k, v in data.items() if k in _allowed},
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_dict(row)


async def update_trust(
    incident_id: str,
    trust_data: dict,
    *,
    session: Optional[AsyncSession] = None,
) -> Optional[dict]:
    """Patch trust_score, confidence_level, validation_reasons on an incident."""
    patch = {k: v for k, v in trust_data.items() if k in ("trust_score", "confidence_level", "validation_reasons")}
    if not patch:
        return await get_by_id(incident_id, session=session)

    if not db_enabled() or session is None:
        return mock.update_incident(incident_id, patch)

    from app.models.incident import Incident
    from sqlalchemy import update as sa_update
    stmt = (
        sa_update(Incident)
        .where(Incident.id == incident_id)
        .values(**patch)
        .returning(Incident)
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    return _to_dict(row) if row else None


async def update_status(
    incident_id: str,
    status: str,
    *,
    session: Optional[AsyncSession] = None,
    admin_notes: Optional[str] = None,
    actor: Optional[str] = None,
) -> Optional[dict]:
    patch: dict = {"status": status}
    if status == "verified":
        patch["verified"] = True
    if admin_notes is not None:
        patch["admin_notes"] = admin_notes

    if not db_enabled() or session is None:
        return mock.update_incident(incident_id, patch)

    from app.models.incident import Incident
    stmt = (
        sa_update(Incident)
        .where(Incident.id == incident_id)
        .values(**patch)
        .returning(Incident)
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    return _to_dict(row) if row else None


async def get_analytics(*, session: Optional[AsyncSession] = None) -> dict:
    items: List[dict]
    if not db_enabled() or session is None:
        items = mock.get_all_incidents()
    else:
        from app.models.incident import Incident
        rows = (await session.execute(select(Incident))).scalars().all()
        items = [_to_dict(r) for r in rows]
    return _analytics(items)


# ── Mock helpers ──────────────────────────────────────────────────────────────

_SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _mock_list(
    *,
    severity: Optional[str],
    status: Optional[str],
    search: Optional[str],
    incident_type: Optional[str],
    page: int,
    per_page: int,
    sort_by: str,
    sort_dir: str,
) -> Tuple[List[dict], int]:
    items = mock.get_all_incidents()
    if severity:
        items = [i for i in items if i.get("severity") == severity]
    if status:
        items = [i for i in items if i.get("status") == status]
    if incident_type:
        items = [i for i in items if i.get("type") == incident_type]
    if search:
        q = search.lower()
        items = [
            i for i in items
            if q in i.get("title", "").lower()
            or q in i.get("location_name", "").lower()
            or q in i.get("description", "").lower()
        ]
    total = len(items)
    rev = sort_dir == "desc"
    if sort_by == "severity":
        items.sort(key=lambda i: _SEV_ORDER.get(i.get("severity", "low"), 4), reverse=rev)
    else:
        items.sort(key=lambda i: i.get("timestamp", ""), reverse=rev)
    start = (page - 1) * per_page
    return items[start : start + per_page], total


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _db_list(
    *,
    session: AsyncSession,
    severity: Optional[str],
    status: Optional[str],
    search: Optional[str],
    incident_type: Optional[str],
    page: int,
    per_page: int,
    sort_by: str,
    sort_dir: str,
) -> Tuple[List[dict], int]:
    from app.models.incident import Incident

    stmt = select(Incident)
    count_stmt = select(func.count()).select_from(Incident)

    def _apply(s, c):
        if severity:
            s, c = s.where(Incident.severity == severity), c.where(Incident.severity == severity)
        if status:
            s, c = s.where(Incident.status == status), c.where(Incident.status == status)
        if incident_type:
            s, c = s.where(Incident.type == incident_type), c.where(Incident.type == incident_type)
        if search:
            like = f"%{search}%"
            cond = or_(
                Incident.title.ilike(like),
                Incident.location_name.ilike(like),
                Incident.description.ilike(like),
            )
            s, c = s.where(cond), c.where(cond)
        return s, c

    stmt, count_stmt = _apply(stmt, count_stmt)
    total: int = (await session.execute(count_stmt)).scalar_one()

    col = getattr(Incident, sort_by if hasattr(Incident, sort_by) else "timestamp", Incident.timestamp)
    stmt = stmt.order_by(col.desc() if sort_dir == "desc" else col.asc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    rows = (await session.execute(stmt)).scalars().all()
    return [_to_dict(r) for r in rows], total


def _to_dict(row) -> dict:
    return {
        "id": row.id,
        "type": row.type,
        "title": row.title,
        "description": row.description,
        "severity": row.severity,
        "status": row.status,
        "lat": row.lat,
        "lng": row.lng,
        "location_name": row.location_name,
        "reporter_name": row.reporter_name,
        "reporter_phone": row.reporter_phone,
        "reporter_id": row.reporter_id,
        "affected_count": row.affected_count,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "ai_category": row.ai_category,
        "ai_confidence": row.ai_confidence,
        "verified": bool(row.verified),
        "admin_notes": getattr(row, "admin_notes", None),
        "trust_score": getattr(row, "trust_score", None),
        "confidence_level": getattr(row, "confidence_level", None),
        "validation_reasons": getattr(row, "validation_reasons", None),
    }


def _analytics(items: List[dict]) -> dict:
    by_severity: Dict[str, int] = {}
    by_status: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    for inc in items:
        s = inc.get("severity", "unknown")
        by_severity[s] = by_severity.get(s, 0) + 1
        st = inc.get("status", "unknown")
        by_status[st] = by_status.get(st, 0) + 1
        t = inc.get("type", "other")
        by_type[t] = by_type.get(t, 0) + 1
    return {
        "total": len(items),
        "by_severity": by_severity,
        "by_status": by_status,
        "by_type": by_type,
        "affected_total": sum(inc.get("affected_count") or 0 for inc in items),
    }
