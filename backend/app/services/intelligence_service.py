"""External Intelligence Service.

Orchestrates:
  1. Data ingestion from weather / climate / fire providers
  2. Proximity matching between observations and incidents
  3. Combined AI analysis — risk score, confidence, summary, recommended actions
  4. Dashboard data aggregation for the frontend panel

CONTRACT:
  AI analysis NEVER modifies incident.verified.
  Human Admin/Responder must perform final verification.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.weather_provider import weather_provider
from app.services.climate_provider import climate_provider
from app.services.fire_provider import fire_provider
from app.db import observation_repo
from app.db import incident_repo

logger = logging.getLogger(__name__)

NAIROBI_CENTER = (-1.2921, 36.8219)


# ── Geometry ─────────────────────────────────────────────────────────────────

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


# ── Ingestion ─────────────────────────────────────────────────────────────────

async def ingest_observations(
    lat: float,
    lng: float,
    *,
    session: Optional[AsyncSession] = None,
    link_incident_id: Optional[str] = None,
) -> list[dict]:
    """
    Fetch from all three providers and persist.
    Returns list of stored observation dicts.
    """
    stored: list[dict] = []

    for label, fn in [
        ("weather",    lambda: weather_provider.get_current(lat, lng)),
        ("climate",    lambda: climate_provider.get_climate(lat, lng)),
    ]:
        try:
            data = fn()
            data["linked_incident_id"] = link_incident_id
            obs = await observation_repo.create_observation(data, session=session)
            stored.append(obs)
        except Exception as exc:
            logger.warning("%s ingestion failed: %s", label, exc)

    try:
        for h in fire_provider.get_hotspots(lat, lng):
            h["linked_incident_id"] = link_incident_id
            obs = await observation_repo.create_observation(h, session=session)
            stored.append(obs)
    except Exception as exc:
        logger.warning("fire_hotspot ingestion failed: %s", exc)

    return stored


# ── Incident analysis ─────────────────────────────────────────────────────────

async def analyze_incident(
    incident_id: str,
    *,
    session: Optional[AsyncSession] = None,
) -> dict:
    """
    Full intelligence analysis for one incident.

    Combines:
    - The incident record (citizen report)
    - Current weather at the incident's location
    - Fire hotspots within 25 km
    - Previously stored observations within 25 km / 48 h
    - Corroborating reports from other citizens within 5 km / 48 h

    Returns a risk assessment. Does NOT modify incident.verified.
    """
    incident = await incident_repo.get_by_id(incident_id, session=session)
    if not incident:
        return {"error": f"Incident {incident_id} not found"}

    lat, lng = incident["lat"], incident["lng"]
    inc_ts   = _parse_dt(incident.get("timestamp"))

    # Environmental data
    weather  = weather_provider.get_current(lat, lng)
    hotspots = fire_provider.get_hotspots(lat, lng, radius_km=25.0)

    # Stored observations in vicinity
    nearby_obs = await observation_repo.list_near(
        lat, lng, radius_km=25.0, hours=48, session=session
    )

    # Corroborating citizen reports (other incidents within 5 km / 48 h)
    all_incidents, _ = await incident_repo.list_incidents(session=session, per_page=500)
    nearby_reports: list[dict] = []
    for other in all_incidents:
        if other["id"] == incident_id:
            continue
        if _haversine_km(lat, lng, other["lat"], other["lng"]) > 5.0:
            continue
        if abs((_parse_dt(other.get("timestamp")) - inc_ts).total_seconds()) >= 48 * 3600:
            continue
        nearby_reports.append(other)

    # AI analysis
    from app.services.gemini_service import analyze_with_intelligence
    analysis = analyze_with_intelligence(
        incident=incident,
        weather=weather,
        fire_hotspots=hotspots,
        nearby_obs=nearby_obs,
        nearby_reports=nearby_reports,
    )

    return {
        "incident_id":              incident_id,
        "analyzed_at":              datetime.now(timezone.utc).isoformat(),
        "weather":                  weather,
        "fire_hotspot_count":       len(hotspots),
        "nearby_observation_count": len(nearby_obs),
        "nearby_report_count":      len(nearby_reports),
        **analysis,
    }


# ── Dashboard aggregation ─────────────────────────────────────────────────────

async def get_dashboard_data(
    *,
    session: Optional[AsyncSession] = None,
) -> dict:
    """
    Aggregated intelligence data for the frontend panel.
    Always returns something — providers fall back to mock automatically.
    """
    lat, lng = NAIROBI_CENTER
    weather  = weather_provider.get_current(lat, lng)
    climate  = climate_provider.get_climate(lat, lng)
    hotspots = fire_provider.get_hotspots(lat, lng)
    obs_counts = await observation_repo.count_by_type(session=session)

    def _label(s: str, live_name: str, mock_name: str) -> str:
        return live_name if not s.startswith("mock") else mock_name

    sources = [
        _label(weather.get("source", "mock"), "OpenWeatherMap", "Weather (Mock)"),
        _label(climate.get("source", "mock"), "NASA POWER",     "Climate (Mock)"),
        _label(
            hotspots[0].get("source", "mock") if hotspots else "mock",
            "NASA FIRMS",
            "Fire Hotspots (Mock)",
        ),
    ]

    mode = "live" if not weather.get("source", "mock").startswith("mock") else "mock"

    return {
        "weather":              weather,
        "climate":              climate,
        "fire_hotspot_count":   len(hotspots),
        "fire_hotspots":        hotspots,
        "observation_counts":   obs_counts,
        "data_sources_active":  sources,
        "last_updated":         datetime.now(timezone.utc).isoformat(),
        "mode":                 mode,
    }
