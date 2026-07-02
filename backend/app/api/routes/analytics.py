"""Analytics API routes — Sentinel AI Predictive Analytics module."""
from fastapi import APIRouter, Depends, Query

from app.db.database import get_optional_session as get_session, db_enabled
from app.db import mock_data as md
from app.services.analytics_service import (
    get_incident_trends,
    get_hotspot_clusters,
    get_resource_demand_forecast,
    get_shelter_forecast,
    get_response_time_analysis,
    get_risk_timeline,
    generate_executive_briefing,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _orm_to_dict(row) -> dict:
    """Convert any SQLAlchemy ORM row to a plain dict with ISO datetime strings."""
    d: dict = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name, None)
        if hasattr(val, "isoformat"):
            val = val.isoformat()
        d[col.name] = val
    return d


async def _load_all(session) -> tuple[list, list, list, list]:
    """Load incidents, resources, requests, shelters from mock or DB."""
    if not db_enabled() or session is None:
        return (
            md.get_all_incidents(),
            md.get_all_resources(),
            md.get_all_requests(),
            md.get_all_shelters(),
        )

    from sqlalchemy import select
    from app.models.incident import Incident
    from app.models.resource import Resource as ResourceModel
    from app.models.resource_request import ResourceRequest

    incs = [_orm_to_dict(r) for r in
            (await session.execute(select(Incident))).scalars().all()]
    ress = [_orm_to_dict(r) for r in
            (await session.execute(select(ResourceModel))).scalars().all()]
    reqs = [_orm_to_dict(r) for r in
            (await session.execute(select(ResourceRequest))).scalars().all()]
    return incs, ress, reqs, md.get_all_shelters()


@router.get("/trends")
async def incident_trends(
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    session=Depends(get_session),
):
    incs, _, _, _ = await _load_all(session)
    return {"period": period, "data": get_incident_trends(incs, period)}


@router.get("/hotspots")
async def hotspot_clusters(session=Depends(get_session)):
    incs, _, _, _ = await _load_all(session)
    return {"clusters": get_hotspot_clusters(incs)}


@router.get("/resource-forecast")
async def resource_forecast(session=Depends(get_session)):
    incs, ress, reqs, _ = await _load_all(session)
    return {"forecast": get_resource_demand_forecast(incs, ress, reqs)}


@router.get("/shelter-forecast")
async def shelter_forecast_endpoint(session=Depends(get_session)):
    incs, _, _, shts = await _load_all(session)
    return {"forecast": get_shelter_forecast(shts, incs)}


@router.get("/response-time")
async def response_time(session=Depends(get_session)):
    incs, _, _, _ = await _load_all(session)
    return get_response_time_analysis(incs)


@router.get("/risk-timeline")
async def risk_timeline(
    days: int = Query(7, ge=3, le=30),
    session=Depends(get_session),
):
    incs, _, _, _ = await _load_all(session)
    return {"timeline": get_risk_timeline(incs, days)}


@router.get("/briefing")
async def executive_briefing(session=Depends(get_session)):
    incs, ress, reqs, shts = await _load_all(session)
    return await generate_executive_briefing(incs, ress, reqs, shts)
