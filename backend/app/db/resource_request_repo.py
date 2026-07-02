"""Resource request CRUD — DB / mock dual-mode."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.mock_data as mock
from app.db.database import db_enabled


async def list_requests(
    *,
    status: Optional[str] = None,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    incident_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    session: Optional[AsyncSession] = None,
) -> Tuple[List[dict], int]:
    if not db_enabled() or session is None:
        return mock.filter_requests(
            page=page, per_page=per_page,
            status=status, category=category,
            urgency=urgency, incident_id=incident_id,
        )
    from app.models.resource_request import ResourceRequest
    stmt = select(ResourceRequest)
    count_stmt = select(func.count()).select_from(ResourceRequest)
    if status:
        stmt = stmt.where(ResourceRequest.status == status)
        count_stmt = count_stmt.where(ResourceRequest.status == status)
    if category:
        stmt = stmt.where(ResourceRequest.category == category)
        count_stmt = count_stmt.where(ResourceRequest.category == category)
    if urgency:
        stmt = stmt.where(ResourceRequest.urgency == urgency)
        count_stmt = count_stmt.where(ResourceRequest.urgency == urgency)
    if incident_id:
        stmt = stmt.where(ResourceRequest.incident_id == incident_id)
        count_stmt = count_stmt.where(ResourceRequest.incident_id == incident_id)
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(ResourceRequest.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_dict(r) for r in rows], total


async def get_by_id(
    request_id: str, *, session: Optional[AsyncSession] = None
) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.get_request_by_id(request_id)
    from app.models.resource_request import ResourceRequest
    row = (
        await session.execute(
            select(ResourceRequest).where(ResourceRequest.id == request_id)
        )
    ).scalar_one_or_none()
    return _to_dict(row) if row else None


async def create(data: dict, *, session: Optional[AsyncSession] = None) -> dict:
    if not db_enabled() or session is None:
        return mock.create_request(data)
    from app.models.resource_request import ResourceRequest
    _allowed = {
        "requester_name", "requester_phone", "requester_location",
        "lat", "lng", "category", "quantity_needed", "description",
        "incident_id", "urgency",
    }
    now = datetime.now(timezone.utc)
    row = ResourceRequest(
        id=f"req-{uuid4().hex[:8]}",
        created_at=now,
        updated_at=now,
        status="pending",
        **{k: v for k, v in data.items() if k in _allowed},
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_dict(row)


async def update_status(
    request_id: str,
    data: dict,
    *,
    session: Optional[AsyncSession] = None,
) -> Optional[dict]:
    if not db_enabled() or session is None:
        patch = {k: v for k, v in data.items() if v is not None}
        if data.get("status") == "fulfilled":
            patch["fulfilled_at"] = datetime.now(timezone.utc).isoformat()
        return mock.update_request(request_id, patch)
    from app.models.resource_request import ResourceRequest
    _allowed = {"status", "responder_notes", "fulfilled_by_resource_id"}
    values = {k: v for k, v in data.items() if k in _allowed and v is not None}
    values["updated_at"] = datetime.now(timezone.utc)
    if data.get("status") == "fulfilled":
        values["fulfilled_at"] = datetime.now(timezone.utc)
    stmt = (
        sa_update(ResourceRequest)
        .where(ResourceRequest.id == request_id)
        .values(**values)
        .returning(ResourceRequest)
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    return _to_dict(row) if row else None


def _to_dict(row) -> dict:
    def _iso(v):
        return v.isoformat() if v and hasattr(v, "isoformat") else (v or None)

    return {
        "id": row.id,
        "requester_name": row.requester_name,
        "requester_phone": getattr(row, "requester_phone", None),
        "requester_location": row.requester_location,
        "lat": getattr(row, "lat", None),
        "lng": getattr(row, "lng", None),
        "category": row.category,
        "quantity_needed": getattr(row, "quantity_needed", 1),
        "description": row.description,
        "incident_id": getattr(row, "incident_id", None),
        "urgency": getattr(row, "urgency", "medium"),
        "status": row.status,
        "fulfilled_by_resource_id": getattr(row, "fulfilled_by_resource_id", None),
        "responder_notes": getattr(row, "responder_notes", None),
        "created_at": _iso(getattr(row, "created_at", None)) or "",
        "updated_at": _iso(getattr(row, "updated_at", None)) or "",
        "fulfilled_at": _iso(getattr(row, "fulfilled_at", None)),
    }
