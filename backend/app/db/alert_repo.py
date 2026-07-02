"""Alert CRUD — DB / mock dual-mode.

All public functions accept an optional `session` parameter.
When session is None (mock mode) they delegate to mock_data.py.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.mock_data as mock
from app.db.database import db_enabled


async def create(data: dict, *, session: Optional[AsyncSession] = None) -> dict:
    if not db_enabled() or session is None:
        return mock.create_alert(data)

    from app.models.alert import Alert
    _allowed = {
        "title", "message_en", "message_sw", "message_fr", "message_ar",
        "severity", "category", "expires_at", "affected_areas", "source",
        "ai_generated", "incident_id", "notification_channels", "delivery_status",
        "radius_km", "lat", "lng", "recommended_actions",
        "evacuation_guidance", "public_safety_message", "districts",
    }
    row = Alert(
        id=f"alrt-{uuid4().hex[:6]}",
        issued_at=datetime.now(timezone.utc),
        active=True,
        **{k: v for k, v in data.items() if k in _allowed},
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_dict(row)


async def get_all(*, active_only: bool = True, session: Optional[AsyncSession] = None) -> List[dict]:
    if not db_enabled() or session is None:
        return mock.get_all_alerts() if active_only else mock.get_all_alerts_history()

    from app.models.alert import Alert
    stmt = select(Alert)
    if active_only:
        stmt = stmt.where(Alert.active.is_(True))
    stmt = stmt.order_by(Alert.issued_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_dict(r) for r in rows]


async def get_by_id(alert_id: str, *, session: Optional[AsyncSession] = None) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.get_alert_by_id(alert_id)

    from app.models.alert import Alert
    row = (
        await session.execute(select(Alert).where(Alert.id == alert_id))
    ).scalar_one_or_none()
    return _to_dict(row) if row else None


async def update_delivery(
    alert_id: str,
    delivery_status: Dict[str, str],
    *,
    session: Optional[AsyncSession] = None,
) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.update_alert(alert_id, {"delivery_status": delivery_status})

    from app.models.alert import Alert
    stmt = (
        sa_update(Alert)
        .where(Alert.id == alert_id)
        .values(delivery_status=delivery_status)
        .returning(Alert)
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    return _to_dict(row) if row else None


async def dismiss(alert_id: str, *, session: Optional[AsyncSession] = None) -> Optional[dict]:
    if not db_enabled() or session is None:
        return mock.update_alert(alert_id, {"active": False})

    from app.models.alert import Alert
    stmt = (
        sa_update(Alert)
        .where(Alert.id == alert_id)
        .values(active=False)
        .returning(Alert)
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()
    return _to_dict(row) if row else None


async def list_history(
    *,
    page: int = 1,
    per_page: int = 20,
    severity: Optional[str] = None,
    district: Optional[str] = None,
    active_only: bool = False,
    session: Optional[AsyncSession] = None,
) -> Tuple[List[dict], int]:
    if not db_enabled() or session is None:
        return mock.filter_alerts(
            page=page,
            per_page=per_page,
            severity=severity,
            district=district,
            active_only=active_only,
        )

    from app.models.alert import Alert
    stmt = select(Alert)
    count_stmt = select(func.count()).select_from(Alert)

    if active_only:
        stmt = stmt.where(Alert.active.is_(True))
        count_stmt = count_stmt.where(Alert.active.is_(True))
    if severity:
        stmt = stmt.where(Alert.severity == severity)
        count_stmt = count_stmt.where(Alert.severity == severity)

    total: int = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Alert.issued_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_dict(r) for r in rows], total


def _to_dict(row) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "message_en": row.message_en,
        "message_sw": getattr(row, "message_sw", None),
        "message_fr": getattr(row, "message_fr", None),
        "message_ar": getattr(row, "message_ar", None),
        "severity": row.severity,
        "category": row.category,
        "issued_at": row.issued_at.isoformat() if hasattr(row.issued_at, "isoformat") else row.issued_at,
        "expires_at": (
            row.expires_at.isoformat()
            if row.expires_at and hasattr(row.expires_at, "isoformat")
            else row.expires_at
        ),
        "affected_areas": getattr(row, "affected_areas", None) or [],
        "source": row.source,
        "ai_generated": bool(row.ai_generated),
        "active": bool(getattr(row, "active", True)),
        "incident_id": getattr(row, "incident_id", None),
        "notification_channels": getattr(row, "notification_channels", None) or [],
        "delivery_status": getattr(row, "delivery_status", None) or {},
        "radius_km": getattr(row, "radius_km", None),
        "lat": getattr(row, "lat", None),
        "lng": getattr(row, "lng", None),
        "recommended_actions": getattr(row, "recommended_actions", None) or [],
        "evacuation_guidance": getattr(row, "evacuation_guidance", None),
        "public_safety_message": getattr(row, "public_safety_message", None),
        "districts": getattr(row, "districts", None) or [],
    }
