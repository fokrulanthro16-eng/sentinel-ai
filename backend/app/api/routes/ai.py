from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.db.mock_data import get_all_incidents, get_all_alerts
from app.services.ai_provider import (
    classify_incident,
    generate_multilingual_alert,
    get_action_recommendations,
    generate_risk_summary,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ClassifyRequest(BaseModel):
    description: str
    location: Optional[str] = ""


class MultilingualAlertRequest(BaseModel):
    title: str
    message_en: str
    target_languages: Optional[List[str]] = None


class RecommendRequest(BaseModel):
    incident_ids: Optional[List[str]] = None  # None = all active


@router.post("/classify")
async def classify(req: ClassifyRequest):
    try:
        return await classify_incident(req.description, req.location or "")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/multilingual-alert")
async def multilingual_alert(req: MultilingualAlertRequest):
    return await generate_multilingual_alert(
        title=req.title,
        message_en=req.message_en,
        target_languages=req.target_languages,
    )


@router.post("/recommend")
async def recommend(req: RecommendRequest):
    incidents = get_all_incidents()
    if req.incident_ids:
        incidents = [i for i in incidents if i["id"] in req.incident_ids]
    return await get_action_recommendations(incidents)


@router.get("/risk-summary")
@router.post("/risk-summary")
async def risk_summary():
    incidents = get_all_incidents()
    alerts = get_all_alerts()
    return await generate_risk_summary(incidents, alerts)
