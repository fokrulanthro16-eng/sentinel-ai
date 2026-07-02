"""Resource Coordination routes.

Endpoints
─────────
Legacy (shelters — backward compat):
  GET  /api/resources               → list shelters
  GET  /api/resources/nearest       → nearest shelters

Inventory (admin / responder managed):
  GET  /api/resources/inventory         → paginated resource list
  POST /api/resources/inventory         → create resource
  GET  /api/resources/inventory/stats   → availability stats
  GET  /api/resources/inventory/{id}    → get single resource
  PATCH /api/resources/inventory/{id}   → update availability / status
  POST /api/resources/inventory/{id}/assign → assign to incident

Requests (citizen-facing):
  GET  /api/resources/requests               → paginated requests
  POST /api/resources/requests               → submit request (offline-safe)
  GET  /api/resources/requests/{id}          → get single request
  PATCH /api/resources/requests/{id}/status  → update status (admin/responder)
"""
from __future__ import annotations

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_optional_session as get_session
from app.db import resource_repo, resource_request_repo
from app.db.mock_data import get_all_shelters, get_nearest_shelters
from app.schemas.resource import (
    ShelterOut,
    ResourceCreate, ResourceUpdate, ResourceAssign,
    ResourceOut, PaginatedResources, ResourceStats,
    ResourceRequestCreate, ResourceRequestStatusUpdate,
    ResourceRequestOut, PaginatedRequests,
)
from app.core.connection_manager import manager

router = APIRouter(prefix="/api/resources", tags=["resources"])


# ── Legacy shelter endpoints (backward compat) ─────────────────────────────────

@router.get("", response_model=List[ShelterOut])
async def list_shelters():
    return get_all_shelters()


@router.get("/nearest", response_model=List[ShelterOut])
async def nearest_shelters(
    lat: float = Query(...),
    lng: float = Query(...),
    limit: int = Query(3, ge=1, le=10),
):
    return get_nearest_shelters(lat, lng, limit)


# ── Resource inventory ─────────────────────────────────────────────────────────

@router.get("/inventory/stats", response_model=ResourceStats)
async def resource_stats(session: Optional[AsyncSession] = Depends(get_session)):
    return await resource_repo.get_stats(session=session)


@router.get("/inventory", response_model=PaginatedResources)
async def list_inventory(
    resource_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: Optional[AsyncSession] = Depends(get_session),
):
    items, total = await resource_repo.list_resources(
        resource_type=resource_type,
        status=status,
        page=page,
        per_page=per_page,
        session=session,
    )
    pages = max(1, -(-total // per_page))
    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}


@router.post("/inventory", response_model=ResourceOut, status_code=201)
async def create_resource(
    payload: ResourceCreate,
    session: Optional[AsyncSession] = Depends(get_session),
):
    resource = await resource_repo.create(payload.model_dump(), session=session)
    asyncio.create_task(manager.broadcast({
        "type": "resource.created",
        "resource": resource,
    }))
    return resource


@router.get("/inventory/{resource_id}", response_model=ResourceOut)
async def get_resource(
    resource_id: str,
    session: Optional[AsyncSession] = Depends(get_session),
):
    r = await resource_repo.get_by_id(resource_id, session=session)
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    return r


@router.patch("/inventory/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: str,
    payload: ResourceUpdate,
    session: Optional[AsyncSession] = Depends(get_session),
):
    r = await resource_repo.update(
        resource_id,
        {k: v for k, v in payload.model_dump().items() if v is not None},
        session=session,
    )
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    asyncio.create_task(manager.broadcast({
        "type": "resource.updated",
        "resource": r,
    }))
    return r


@router.post("/inventory/{resource_id}/assign", response_model=ResourceOut)
async def assign_resource(
    resource_id: str,
    payload: ResourceAssign,
    session: Optional[AsyncSession] = Depends(get_session),
):
    r = await resource_repo.assign_to_incident(
        resource_id,
        payload.incident_id,
        deployment_notes=payload.deployment_notes,
        session=session,
    )
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    asyncio.create_task(manager.broadcast({
        "type": "resource.assigned",
        "resource": r,
        "incident_id": payload.incident_id,
    }))
    return r


# ── Resource requests ──────────────────────────────────────────────────────────

@router.get("/requests", response_model=PaginatedRequests)
async def list_requests(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    incident_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: Optional[AsyncSession] = Depends(get_session),
):
    items, total = await resource_request_repo.list_requests(
        status=status,
        category=category,
        urgency=urgency,
        incident_id=incident_id,
        page=page,
        per_page=per_page,
        session=session,
    )
    pages = max(1, -(-total // per_page))
    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}


@router.post("/requests", response_model=ResourceRequestOut, status_code=201)
async def submit_request(
    payload: ResourceRequestCreate,
    session: Optional[AsyncSession] = Depends(get_session),
):
    data = payload.model_dump()

    # Auto-elevate urgency when linked to a high-severity verified incident
    if data.get("incident_id"):
        from app.db import incident_repo
        inc = await incident_repo.get_by_id(data["incident_id"], session=session)
        if inc:
            sev = inc.get("severity", "low")
            if sev == "critical" and data["urgency"] in ("medium", "low"):
                data["urgency"] = "high"
            elif sev == "high" and data["urgency"] == "low":
                data["urgency"] = "medium"

    req = await resource_request_repo.create(data, session=session)
    asyncio.create_task(manager.broadcast({
        "type": "request.created",
        "request": req,
    }))
    return req


@router.get("/requests/{request_id}", response_model=ResourceRequestOut)
async def get_request(
    request_id: str,
    session: Optional[AsyncSession] = Depends(get_session),
):
    r = await resource_request_repo.get_by_id(request_id, session=session)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    return r


@router.patch("/requests/{request_id}/status", response_model=ResourceRequestOut)
async def update_request_status(
    request_id: str,
    payload: ResourceRequestStatusUpdate,
    session: Optional[AsyncSession] = Depends(get_session),
):
    r = await resource_request_repo.get_by_id(request_id, session=session)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    updated = await resource_request_repo.update_status(
        request_id, payload.model_dump(), session=session
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Request not found")
    asyncio.create_task(manager.broadcast({
        "type": "request.updated",
        "request": updated,
    }))
    return updated
