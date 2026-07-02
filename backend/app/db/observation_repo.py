"""Repository — ExternalObservation CRUD with DB / in-memory mock fallback.

Follows the same dual-mode pattern as incident_repo.py:
- When session is None (no DATABASE_URL) → in-memory list.
- When session is an AsyncSession → SQLAlchemy queries.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import db_enabled

# ── In-memory mock store ──────────────────────────────────────────────────────

_mock_store: List[dict] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_dt(s: object) -> datetime:
    if isinstance(s, datetime):
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(s))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _row_to_dict(row) -> dict:
    return {
        "id":                   row.id,
        "source":               row.source,
        "provider_type":        row.provider_type,
        "lat":                  row.lat,
        "lng":                  row.lng,
        "location_name":        getattr(row, "location_name", None),
        "temperature":          getattr(row, "temperature", None),
        "humidity":             getattr(row, "humidity", None),
        "wind_speed":           getattr(row, "wind_speed", None),
        "wind_direction":       getattr(row, "wind_direction", None),
        "precipitation_mm":     getattr(row, "precipitation_mm", None),
        "weather_description":  getattr(row, "weather_description", None),
        "weather_code":         getattr(row, "weather_code", None),
        "fire_radiative_power": getattr(row, "fire_radiative_power", None),
        "brightness":           getattr(row, "brightness", None),
        "fire_confidence":      getattr(row, "fire_confidence", None),
        "solar_irradiance":     getattr(row, "solar_irradiance", None),
        "soil_moisture":        getattr(row, "soil_moisture", None),
        "risk_score":           getattr(row, "risk_score", None),
        "ai_confidence":        getattr(row, "ai_confidence", None),
        "ai_summary":           getattr(row, "ai_summary", None),
        "recommended_actions":  getattr(row, "recommended_actions", None),
        "linked_incident_id":   getattr(row, "linked_incident_id", None),
        "observed_at":          (
            row.observed_at.isoformat()
            if hasattr(row, "observed_at") and row.observed_at else None
        ),
        "ingested_at":          (
            row.ingested_at.isoformat()
            if hasattr(row, "ingested_at") and row.ingested_at else None
        ),
    }


# ── Public API ────────────────────────────────────────────────────────────────

async def create_observation(
    data: dict,
    *,
    session: Optional[AsyncSession] = None,
) -> dict:
    """Store one observation record. Returns the stored dict."""
    if not db_enabled() or session is None:
        record: dict = {
            "id":          f"obs-{uuid4().hex[:8]}",
            "ingested_at": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        _mock_store.append(record)
        return record

    from app.models.external_observation import ExternalObservation

    # Convert ISO string → datetime for SQLAlchemy
    observed_at = _parse_dt(data.get("observed_at", datetime.now(timezone.utc)))
    row = ExternalObservation(
        ingested_at=datetime.now(timezone.utc),
        observed_at=observed_at,
        **{
            k: v
            for k, v in data.items()
            if k not in ("id", "observed_at", "ingested_at")
            and hasattr(ExternalObservation, k)
        },
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_dict(row)


async def list_near(
    lat: float,
    lng: float,
    radius_km: float = 25.0,
    hours: int = 48,
    *,
    session: Optional[AsyncSession] = None,
) -> List[dict]:
    """Observations within radius_km and the past `hours` hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    if not db_enabled() or session is None:
        return [
            o for o in _mock_store
            if _haversine_km(lat, lng, o.get("lat", 0), o.get("lng", 0)) <= radius_km
            and _parse_dt(o.get("observed_at", "")) >= cutoff
        ]

    from app.models.external_observation import ExternalObservation

    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)) + 1e-9)

    rows = (
        await session.execute(
            select(ExternalObservation)
            .where(ExternalObservation.lat.between(lat - lat_delta, lat + lat_delta))
            .where(ExternalObservation.lng.between(lng - lng_delta, lng + lng_delta))
            .where(ExternalObservation.observed_at >= cutoff)
            .order_by(ExternalObservation.observed_at.desc())
            .limit(200)
        )
    ).scalars().all()

    return [
        _row_to_dict(r)
        for r in rows
        if _haversine_km(lat, lng, r.lat, r.lng) <= radius_km
    ]


async def count_by_type(
    *,
    session: Optional[AsyncSession] = None,
) -> Dict[str, int]:
    """Count stored observations by provider_type."""
    if not db_enabled() or session is None:
        counts: Dict[str, int] = {}
        for o in _mock_store:
            t = o.get("provider_type", "unknown")
            counts[t] = counts.get(t, 0) + 1
        return counts

    from app.models.external_observation import ExternalObservation

    rows = (
        await session.execute(
            select(ExternalObservation.provider_type, func.count())
            .group_by(ExternalObservation.provider_type)
        )
    ).all()
    return {pt: cnt for pt, cnt in rows}
