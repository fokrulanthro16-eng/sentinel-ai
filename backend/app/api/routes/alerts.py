from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_optional_session as get_session
from app.db import alert_repo
from app.schemas.alert import AlertCreate, AlertOut, PaginatedAlerts
from app.services.gemini_service import generate_multilingual_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertOut])
async def list_active_alerts(session: Optional[AsyncSession] = Depends(get_session)):
    """Return all currently active alerts."""
    return await alert_repo.get_all(active_only=True, session=session)


@router.get("/history", response_model=PaginatedAlerts)
async def alert_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    severity: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    active_only: bool = Query(False),
    session: Optional[AsyncSession] = Depends(get_session),
):
    """Paginated alert history with optional filters."""
    items, total = await alert_repo.list_history(
        page=page,
        per_page=per_page,
        severity=severity,
        district=district,
        active_only=active_only,
        session=session,
    )
    pages = max(1, -(-total // per_page))  # ceil division
    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}


@router.get("/{alert_id}", response_model=AlertOut)
async def get_alert(alert_id: str, session: Optional[AsyncSession] = Depends(get_session)):
    alert = await alert_repo.get_by_id(alert_id, session=session)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("", response_model=AlertOut, status_code=201)
async def publish_alert(
    payload: AlertCreate,
    session: Optional[AsyncSession] = Depends(get_session),
):
    """Manually publish an alert with multilingual translation."""
    data = payload.model_dump()
    try:
        translations = generate_multilingual_alert(
            title=payload.title,
            message_en=payload.message_en,
            target_languages=["sw", "fr", "ar"],
        )
        data["message_sw"] = translations.get("sw")
        data["message_fr"] = translations.get("fr")
        data["message_ar"] = translations.get("ar")
    except Exception:
        pass
    return await alert_repo.create(data, session=session)


@router.post("/auto-generate/{incident_id}", response_model=AlertOut, status_code=201)
async def auto_generate_alert(
    incident_id: str,
    session: Optional[AsyncSession] = Depends(get_session),
):
    """Trigger alert generation for an existing incident."""
    from app.db import incident_repo
    from app.services.alert_engine import generate_alert
    from app.services.trust_engine import is_public_alert

    incident = await incident_repo.get_by_id(incident_id, session=session)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not is_public_alert(incident):
        raise HTTPException(
            status_code=422,
            detail="Incident does not meet alert threshold (not verified and trust too low)",
        )
    alert = await generate_alert(incident, trigger="manual", session=session)
    return alert


@router.patch("/{alert_id}/dismiss", response_model=AlertOut)
async def dismiss_alert(
    alert_id: str,
    session: Optional[AsyncSession] = Depends(get_session),
):
    """Deactivate / dismiss an alert."""
    alert = await alert_repo.dismiss(alert_id, session=session)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
