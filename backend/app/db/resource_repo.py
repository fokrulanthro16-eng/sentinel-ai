"""Resource inventory CRUD — DB / mock dual-mode."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.mock_data as mock
from app.db.database import db_enabled


async def list_resources(
    *,
    resource_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    session: Optional[AsyncSession] = None,
) -> Tuple[List[dict], int]:
    if not db_enabled() or session is None:
        return mock.filter_resources(
            page=page, per_page=per_page,
            resource_type=resource_type, status=status,
        )
    from app.models.resource import Resource as ResourceModel
    stmt = select(ResourceModel)
    count_stmt = select(func.count()).select_from(ResourceModel)
    if resource_type:
        stmt = stmt.where(ResourceModel.resource_type == resource_type)
        count_stmt = count_stmt.where(ResourceModel.resource_type == resource_type)
    if status:
        stmt = stmt.where(ResourceModel.status == status)
        count_stmt = count_stmt.where(ResourceModel.status == status)
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(ResourceModel.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_dict(r) for r in rows], total


async def get_by_id(
    resource_id: str, *, session: Optional[AsyncSession] = None
) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.get_resource_by_id(resource_id)
    from app.models.resource import Resource as ResourceModel
    row = (
        await session.execute(select(ResourceModel).where(ResourceModel.id == resource_id))
    ).scalar_one_or_none()
    return _to_dict(row) if row else None


async def create(data: dict, *, session: Optional[AsyncSession] = None) -> dict:
    if not db_enabled() or session is None:
        return mock.create_resource(data)
    from app.models.resource import Resource as ResourceModel
    _allowed = {
        "resource_type", "name", "description", "quantity", "unit", "status",
        "owner_org", "contact", "lat", "lng", "location_name",
        "assigned_incident_id", "deployment_notes", "tags",
    }
    now = datetime.now(timezone.utc)
    row = ResourceModel(
        id=f"res-{uuid4().hex[:8]}",
        created_at=now,
        updated_at=now,
        **{k: v for k, v in data.items() if k in _allowed},
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_dict(row)


async def update(
    resource_id: str,
    data: dict,
    *,
    session: Optional[AsyncSession] = None,
) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.update_resource(resource_id, data)
    from app.models.resource import Resource as ResourceModel
    _allowed = {
        "quantity", "status", "location_name", "lat", "lng",
        "deployment_notes", "contact", "assigned_incident_id", "tags",
    }
    values = {k: v for k, v in data.items() if k in _allowed}
    values["updated_at"] = datetime.now(timezone.utc)
    stmt = (
        sa_update(ResourceModel)
        .where(ResourceModel.id == resource_id)
        .values(**values)
        .returning(ResourceModel)
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    return _to_dict(row) if row else None


async def assign_to_incident(
    resource_id: str,
    incident_id: str,
    deployment_notes: Optional[str] = None,
    *,
    session: Optional[AsyncSession] = None,
) -> Optional[dict]:
    return await update(
        resource_id,
        {
            "status": "deployed",
            "assigned_incident_id": incident_id,
            "deployment_notes": deployment_notes or "",
        },
        session=session,
    )


async def get_stats(*, session: Optional[AsyncSession] = None) -> dict:
    if not db_enabled() or session is None:
        return mock.get_resource_stats()
    from app.models.resource import Resource as ResourceModel
    rows = (await session.execute(select(ResourceModel))).scalars().all()
    by_type: dict = {}
    by_status: dict = {}
    for r in rows:
        by_type[r.resource_type] = by_type.get(r.resource_type, 0) + 1
        by_status[r.status] = by_status.get(r.status, 0) + 1
    available_types = {r.resource_type for r in rows if r.status == "available"}
    all_types = {"food", "water", "medical", "shelter", "rescue_team", "vehicle", "volunteer"}
    shortages = sorted(all_types - available_types)
    # pending requests need request_repo — import inline to avoid circulars
    import app.db.mock_data as m
    pending = len([rr for rr in m._resource_requests if rr.get("status") == "pending"])
    critical = len([rr for rr in m._resource_requests if rr.get("status") == "pending" and rr.get("urgency") == "critical"])
    return {
        "total": len(rows),
        "by_type": by_type,
        "by_status": by_status,
        "deployed_count": by_status.get("deployed", 0),
        "available_count": by_status.get("available", 0),
        "pending_requests": pending,
        "critical_requests": critical,
        "shortages": shortages,
    }


def _to_dict(row) -> dict:
    def _iso(v):
        return v.isoformat() if v and hasattr(v, "isoformat") else (v or "")

    return {
        "id": row.id,
        "resource_type": row.resource_type,
        "name": row.name,
        "description": getattr(row, "description", None),
        "quantity": row.quantity,
        "unit": getattr(row, "unit", "units"),
        "status": row.status,
        "owner_org": getattr(row, "owner_org", None),
        "contact": getattr(row, "contact", None),
        "lat": getattr(row, "lat", None),
        "lng": getattr(row, "lng", None),
        "location_name": getattr(row, "location_name", None),
        "assigned_incident_id": getattr(row, "assigned_incident_id", None),
        "deployment_notes": getattr(row, "deployment_notes", None),
        "created_at": _iso(getattr(row, "created_at", None)),
        "updated_at": _iso(getattr(row, "updated_at", None)),
        "tags": getattr(row, "tags", None) or [],
    }
