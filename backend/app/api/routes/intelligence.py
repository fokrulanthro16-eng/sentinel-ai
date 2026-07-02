"""Intelligence API routes.

Exposes weather, climate, fire hotspot, and combined AI analysis endpoints.
All endpoints degrade to mock data when provider API keys are absent.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_optional_session
from app.services import intelligence_service
from app.services.weather_provider import weather_provider
from app.services.climate_provider import climate_provider
from app.services.fire_provider import fire_provider

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


@router.get("/weather")
async def get_weather(
    lat: float = Query(-1.2921, description="Latitude"),
    lng: float = Query(36.8219, description="Longitude"),
):
    """Current weather for coordinates. Falls back to mock if no API key."""
    return weather_provider.get_current(lat, lng)


@router.get("/climate")
async def get_climate(
    lat: float = Query(-1.2921),
    lng: float = Query(36.8219),
):
    """Recent climate observations (NASA POWER or mock)."""
    return climate_provider.get_climate(lat, lng)


@router.get("/fire-hotspots")
async def get_fire_hotspots(
    lat: float = Query(-1.2921),
    lng: float = Query(36.8219),
    radius_km: float = Query(25.0, le=100.0),
):
    """Active satellite fire hotspots near coordinates (NASA FIRMS or mock)."""
    return fire_provider.get_hotspots(lat, lng, radius_km)


@router.get("/observations")
async def list_observations(
    lat: float = Query(-1.2921),
    lng: float = Query(36.8219),
    radius_km: float = Query(25.0, le=100.0),
    hours: int = Query(48, le=168),
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Stored external observations near coordinates within the past N hours."""
    from app.db import observation_repo
    return await observation_repo.list_near(lat, lng, radius_km, hours, session=session)


@router.post("/analyze/{incident_id}")
async def analyze_incident(
    incident_id: str,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """
    Run combined AI intelligence analysis for a specific incident.

    Gathers: citizen report + weather + satellite fire data + corroborating reports.
    Returns: risk_score, ai_confidence, summary, recommended_actions.

    NOTE: Does NOT modify incident.verified. Human Admin/Responder must verify.
    """
    result = await intelligence_service.analyze_incident(incident_id, session=session)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/dashboard")
async def intelligence_dashboard(
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Aggregated intelligence snapshot for the dashboard panel."""
    return await intelligence_service.get_dashboard_data(session=session)


@router.post("/ingest")
async def trigger_ingest(
    lat: float = Query(-1.2921),
    lng: float = Query(36.8219),
    incident_id: Optional[str] = Query(None),
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Manually trigger observation ingestion for a location."""
    observations = await intelligence_service.ingest_observations(
        lat, lng,
        session=session,
        link_incident_id=incident_id,
    )
    return {"ingested": len(observations), "observations": observations}
