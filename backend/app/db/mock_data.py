"""In-memory data store seeded from sample_data JSON files.

Acts as a drop-in replacement for the database layer during development
and demos. Replace with real SQLAlchemy session calls once DATABASE_URL
is configured.
"""
import json
import os
from typing import Dict, List, Optional, Tuple
from uuid import uuid4
from datetime import datetime, timezone

_DATA_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "sample_data"
)


def _load(filename: str) -> List[dict]:
    path = os.path.join(_DATA_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []


# --- In-memory stores ---------------------------------------------------------

_incidents: List[dict] = _load("incidents.json")
_alerts: List[dict] = _load("alerts.json")
_shelters: List[dict] = _load("shelters.json")
_resources: List[dict] = _load("resources.json")
_resource_requests: List[dict] = []


# --- Incident helpers ---------------------------------------------------------

def get_all_incidents() -> List[dict]:
    return list(_incidents)


def get_incident_by_id(incident_id: str) -> dict | None:
    return next((i for i in _incidents if i["id"] == incident_id), None)


def create_incident(data: dict) -> dict:
    incident = {
        "id": f"inc-{uuid4().hex[:6]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "verified": False,
        "status": "active",
        **data,
    }
    _incidents.append(incident)
    return incident


def update_incident(incident_id: str, data: dict) -> dict | None:
    for i, inc in enumerate(_incidents):
        if inc["id"] == incident_id:
            _incidents[i] = {**inc, **data}
            return _incidents[i]
    return None


# --- Alert helpers ------------------------------------------------------------

def get_all_alerts() -> List[dict]:
    return [a for a in _alerts if a.get("active", True)]


def get_all_alerts_history() -> List[dict]:
    return list(_alerts)


def get_alert_by_id(alert_id: str) -> dict | None:
    return next((a for a in _alerts if a["id"] == alert_id), None)


def create_alert(data: dict) -> dict:
    alert = {
        "id": f"alrt-{uuid4().hex[:6]}",
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "active": True,
        **data,
    }
    _alerts.append(alert)
    return alert


def update_alert(alert_id: str, data: dict) -> dict | None:
    for i, a in enumerate(_alerts):
        if a["id"] == alert_id:
            _alerts[i] = {**a, **data}
            return _alerts[i]
    return None


def filter_alerts(
    *,
    page: int = 1,
    per_page: int = 20,
    severity: str | None = None,
    district: str | None = None,
    active_only: bool = False,
) -> tuple[List[dict], int]:
    items = list(_alerts)
    if active_only:
        items = [a for a in items if a.get("active", True)]
    if severity:
        items = [a for a in items if a.get("severity") == severity]
    if district:
        dl = district.lower()
        items = [
            a for a in items
            if any(dl in d.lower() for d in (a.get("districts") or []))
            or any(dl in ar.lower() for ar in (a.get("affected_areas") or []))
        ]
    # Sort newest first
    items.sort(key=lambda a: a.get("issued_at", ""), reverse=True)
    total = len(items)
    start = (page - 1) * per_page
    return items[start : start + per_page], total


# --- Shelter helpers ----------------------------------------------------------

def get_all_shelters() -> List[dict]:
    return list(_shelters)


def get_nearest_shelters(lat: float, lng: float, limit: int = 3) -> List[dict]:
    """Returns shelters sorted by Euclidean distance (good enough for short ranges)."""
    def dist(s: dict) -> float:
        return ((s["lat"] - lat) ** 2 + (s["lng"] - lng) ** 2) ** 0.5

    return sorted(_shelters, key=dist)[:limit]


# --- Resource helpers ---------------------------------------------------------

def get_all_resources(
    resource_type: Optional[str] = None,
    status: Optional[str] = None,
) -> List[dict]:
    items = list(_resources)
    if resource_type:
        items = [r for r in items if r.get("resource_type") == resource_type]
    if status:
        items = [r for r in items if r.get("status") == status]
    return items


def get_resource_by_id(resource_id: str) -> Optional[dict]:
    return next((r for r in _resources if r["id"] == resource_id), None)


def create_resource(data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    resource = {
        "id": f"res-{uuid4().hex[:8]}",
        "created_at": now,
        "updated_at": now,
        "status": "available",
        "quantity": 1,
        "unit": "units",
        "tags": [],
        **data,
    }
    _resources.append(resource)
    return resource


def update_resource(resource_id: str, data: dict) -> Optional[dict]:
    for i, r in enumerate(_resources):
        if r["id"] == resource_id:
            _resources[i] = {**r, **data, "updated_at": datetime.now(timezone.utc).isoformat()}
            return _resources[i]
    return None


def filter_resources(
    *,
    page: int = 1,
    per_page: int = 20,
    resource_type: Optional[str] = None,
    status: Optional[str] = None,
) -> Tuple[List[dict], int]:
    items = list(_resources)
    if resource_type:
        items = [r for r in items if r.get("resource_type") == resource_type]
    if status:
        items = [r for r in items if r.get("status") == status]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    total = len(items)
    start = (page - 1) * per_page
    return items[start: start + per_page], total


def get_resource_stats() -> dict:
    by_type: Dict[str, int] = {}
    by_status: Dict[str, int] = {}
    for r in _resources:
        rt = r.get("resource_type", "other")
        rs = r.get("status", "unknown")
        by_type[rt] = by_type.get(rt, 0) + 1
        by_status[rs] = by_status.get(rs, 0) + 1

    available_types = {r.get("resource_type") for r in _resources if r.get("status") == "available"}
    all_types = {"food", "water", "medical", "shelter", "rescue_team", "vehicle", "volunteer"}
    shortages = sorted(all_types - available_types)

    pending_reqs = [rr for rr in _resource_requests if rr.get("status") == "pending"]
    critical_reqs = [rr for rr in pending_reqs if rr.get("urgency") == "critical"]

    return {
        "total": len(_resources),
        "by_type": by_type,
        "by_status": by_status,
        "deployed_count": by_status.get("deployed", 0),
        "available_count": by_status.get("available", 0),
        "pending_requests": len(pending_reqs),
        "critical_requests": len(critical_reqs),
        "shortages": shortages,
    }


# --- Resource Request helpers -------------------------------------------------

def get_all_requests(
    status: Optional[str] = None,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
) -> List[dict]:
    items = list(_resource_requests)
    if status:
        items = [r for r in items if r.get("status") == status]
    if category:
        items = [r for r in items if r.get("category") == category]
    if urgency:
        items = [r for r in items if r.get("urgency") == urgency]
    return items


def get_request_by_id(request_id: str) -> Optional[dict]:
    return next((r for r in _resource_requests if r["id"] == request_id), None)


def create_request(data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    request = {
        "id": f"req-{uuid4().hex[:8]}",
        "created_at": now,
        "updated_at": now,
        "status": "pending",
        "urgency": "medium",
        "quantity_needed": 1,
        **data,
    }
    _resource_requests.append(request)
    return request


def update_request(request_id: str, data: dict) -> Optional[dict]:
    for i, r in enumerate(_resource_requests):
        if r["id"] == request_id:
            _resource_requests[i] = {**r, **data, "updated_at": datetime.now(timezone.utc).isoformat()}
            return _resource_requests[i]
    return None


def filter_requests(
    *,
    page: int = 1,
    per_page: int = 20,
    status: Optional[str] = None,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    incident_id: Optional[str] = None,
) -> Tuple[List[dict], int]:
    items = list(_resource_requests)
    if status:
        items = [r for r in items if r.get("status") == status]
    if category:
        items = [r for r in items if r.get("category") == category]
    if urgency:
        items = [r for r in items if r.get("urgency") == urgency]
    if incident_id:
        items = [r for r in items if r.get("incident_id") == incident_id]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    total = len(items)
    start = (page - 1) * per_page
    return items[start: start + per_page], total
