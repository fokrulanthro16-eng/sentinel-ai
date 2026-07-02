import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_optional_session
from app.db import incident_repo as repo
from app.db import trust_audit_repo as audit_repo
from app.schemas.incident import (
    IncidentCreate, IncidentOut, StatusUpdate,
    PaginatedIncidents, IncidentAnalytics, VALID_STATUSES,
    TrustResult, TrustOverride, AuditLogEntry,
)
from app.services.gemini_service import classify_incident, calculate_trust
from app.services.trust_engine import calculate_trust_score, is_public_alert
from app.core.connection_manager import manager
from app.services import alert_engine
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("/analytics", response_model=IncidentAnalytics)
async def get_analytics(
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    return await repo.get_analytics(session=session)


@router.get("/admin", response_model=PaginatedIncidents)
async def list_incidents_admin(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    incident_type: Optional[str] = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = "timestamp",
    sort_dir: str = "desc",
    session: Optional[AsyncSession] = Depends(get_optional_session),
    _user: Optional[dict] = Depends(get_current_user),
):
    """Paginated incident list for the admin panel."""
    items, total = await repo.list_incidents(
        session=session,
        severity=severity,
        status=status,
        search=search,
        incident_type=incident_type,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    pages = max(1, (total + per_page - 1) // per_page)
    return PaginatedIncidents(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.get("", response_model=List[IncidentOut])
async def list_incidents(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1, le=500),
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Flat incident list — backwards-compatible with the dashboard and map."""
    items, _ = await repo.list_incidents(
        session=session,
        severity=severity,
        status=status,
        search=search,
        per_page=min(limit or 200, 500),
    )
    return items


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: str,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    incident = await repo.get_by_id(incident_id, session=session)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("", response_model=IncidentOut, status_code=201)
async def submit_incident(
    payload: IncidentCreate,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    # Step 1: AI classification
    ai = classify_incident(
        description=payload.description,
        location=payload.location_name,
    )
    data = payload.model_dump()
    data["ai_category"] = ai.get("category")
    data["ai_confidence"] = ai.get("confidence")
    if ai.get("confidence", 0) > 0.85 and not data.get("severity"):
        data["severity"] = ai.get("severity", "medium")

    # Step 2: Initial trust score (heuristic only — fast, no external calls)
    trust = calculate_trust_score(data)
    data["trust_score"] = trust["trust_score"]
    data["confidence_level"] = trust["confidence_level"]
    data["validation_reasons"] = trust["validation_reasons"]

    # Step 3: Persist
    result = await repo.create(data, session=session)

    # Step 4: Log initial trust calculation (awaited — same session, before it closes)
    await audit_repo.log_action(
        incident_id=result["id"],
        action="trust_calculated",
        actor="system",
        trust_score_after=trust["trust_score"],
        confidence_after=trust["confidence_level"],
        notes="Initial heuristic trust score on creation",
        session=session,
    )

    # Step 5: Broadcast — tag with is_public_alert flag
    alert_flag = is_public_alert(result)
    asyncio.create_task(
        manager.broadcast({
            "type": "incident.created",
            "incident": result,
            "is_public_alert": alert_flag,
        })
    )

    # Step 6: Auto-generate alert for critical+high-confidence incidents
    conf = trust.get("confidence_level", "low")
    if (
        data.get("severity") == "critical"
        and conf in ("high", "verified_candidate")
    ):
        asyncio.create_task(
            alert_engine.generate_alert(result, trigger="auto_high_confidence", session=session)
        )

    return result


@router.patch("/{incident_id}/status", response_model=IncidentOut)
async def update_status(
    incident_id: str,
    body: StatusUpdate,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of {sorted(VALID_STATUSES)}",
        )
    old = await repo.get_by_id(incident_id, session=session)
    if not old:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = old.get("status") if isinstance(old, dict) else getattr(old, "status", None)
    old_trust = old.get("trust_score") if isinstance(old, dict) else None

    updated = await repo.update_status(
        incident_id, body.status,
        session=session,
        admin_notes=body.admin_notes,
        actor=body.actor,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Log status change to audit trail (awaited — before session closes)
    await audit_repo.log_action(
        incident_id=incident_id,
        action="status_change",
        actor=body.actor or "admin",
        previous_status=old_status,
        new_status=body.status,
        trust_score_before=old_trust,
        trust_score_after=updated.get("trust_score"),
        notes=body.admin_notes,
        session=session,
    )

    asyncio.create_task(
        manager.broadcast({
            "type": "incident.updated",
            "incident": updated,
            "previous_status": old_status,
            "is_public_alert": is_public_alert(updated),
        })
    )

    # Auto-generate alert when incident is verified
    if body.status == "verified":
        asyncio.create_task(
            alert_engine.generate_alert(updated, trigger="verified", session=session)
        )

    return updated


# ── Trust Endpoints ───────────────────────────────────────────────────────────

@router.get("/{incident_id}/trust", response_model=TrustResult)
async def get_trust(
    incident_id: str,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Return the current trust score and validation reasons for an incident."""
    incident = await repo.get_by_id(incident_id, session=session)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.get("trust_score") is not None:
        return TrustResult(
            trust_score=incident["trust_score"],
            confidence_level=incident.get("confidence_level", "low"),
            validation_reasons=incident.get("validation_reasons") or [],
        )

    # Re-calculate if missing (e.g., legacy mock data)
    trust = calculate_trust_score(incident)
    return TrustResult(**trust)


@router.post("/{incident_id}/trust/recalculate", response_model=TrustResult)
async def recalculate_trust(
    incident_id: str,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Recalculate trust score using full intelligence data (weather + satellite + corroborating reports)."""
    incident = await repo.get_by_id(incident_id, session=session)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_score = incident.get("trust_score")
    old_conf = incident.get("confidence_level")

    # Fetch intelligence data
    weather = None
    fire_hotspots = []
    nearby_reports = []
    try:
        from app.services.intelligence_service import (
            NAIROBI_CENTER, intelligence_session,
        )
        from app.services.weather_provider import weather_provider
        from app.services.fire_provider import fire_provider
        from app.db.incident_repo import list_incidents
        import math

        lat = incident.get("lat", NAIROBI_CENTER[0])
        lng = incident.get("lng", NAIROBI_CENTER[1])
        weather = weather_provider.get_current(lat, lng)
        fire_hotspots = fire_provider.get_hotspots(lat, lng, radius_km=25.0)

        # Corroborating reports: other incidents within 5 km / 48 h
        all_items, _ = await list_incidents(session=session, per_page=500)
        for r in all_items:
            if r["id"] == incident_id:
                continue
            dlat = r.get("lat", 0) - lat
            dlng = r.get("lng", 0) - lng
            dist_km = math.sqrt(dlat**2 + dlng**2) * 111
            if dist_km <= 5:
                nearby_reports.append(r)
    except Exception:
        pass

    # Gemini semantic component (optional)
    try:
        semantic = calculate_trust(incident, nearby_reports)
        ai_bonus = semantic.get("semantic_bonus", 0)
        ai_reasons = semantic.get("semantic_reasons", [])
    except Exception:
        ai_bonus = 0
        ai_reasons = []

    trust = calculate_trust_score(
        incident,
        weather=weather,
        fire_hotspots=fire_hotspots,
        nearby_reports=nearby_reports,
        ai_semantic_bonus=ai_bonus,
        ai_semantic_reasons=ai_reasons,
    )

    # Persist updated trust fields
    await repo.update_trust(incident_id, trust, session=session)

    await audit_repo.log_action(
        incident_id=incident_id,
        action="trust_recalculated",
        actor="system",
        trust_score_before=old_score,
        trust_score_after=trust["trust_score"],
        confidence_before=old_conf,
        confidence_after=trust["confidence_level"],
        notes=f"Recalculated with intelligence data ({len(nearby_reports)} nearby reports, {len(fire_hotspots)} hotspots)",
        session=session,
    )

    return TrustResult(**trust)


@router.patch("/{incident_id}/trust/override", response_model=TrustResult)
async def override_trust(
    incident_id: str,
    body: TrustOverride,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Admin manual override of trust score and confidence level."""
    incident = await repo.get_by_id(incident_id, session=session)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_score = incident.get("trust_score")
    old_conf = incident.get("confidence_level")

    trust_data = {
        "trust_score": body.trust_score,
        "confidence_level": body.confidence_level,
        "validation_reasons": incident.get("validation_reasons") or [],
    }
    if body.notes:
        reasons = list(trust_data["validation_reasons"])
        reasons.insert(0, f"Admin override: {body.notes}")
        trust_data["validation_reasons"] = reasons

    updated = await repo.update_trust(incident_id, trust_data, session=session)

    await audit_repo.log_action(
        incident_id=incident_id,
        action="override",
        actor=body.actor or "admin",
        trust_score_before=old_score,
        trust_score_after=body.trust_score,
        confidence_before=old_conf,
        confidence_after=body.confidence_level,
        notes=body.notes,
        session=session,
    )

    return TrustResult(**trust_data)


@router.get("/{incident_id}/audit", response_model=List[AuditLogEntry])
async def get_audit_log(
    incident_id: str,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    """Return audit trail for an incident."""
    incident = await repo.get_by_id(incident_id, session=session)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return await audit_repo.get_for_incident(incident_id, session=session)
