from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ── Shelter (legacy — kept for backward compat) ───────────────────────────────

class ShelterOut(BaseModel):
    id: str
    name: str
    type: str
    lat: float
    lng: float
    address: str
    capacity: int
    current_occupancy: int
    amenities: List[str] = []
    contact: Optional[str] = None
    status: Literal["open", "nearly_full", "full", "closed"]
    notes: Optional[str] = None

    @property
    def availability_pct(self) -> float:
        if self.capacity == 0:
            return 0.0
        return round((1 - self.current_occupancy / self.capacity) * 100, 1)


# ── Resource inventory ────────────────────────────────────────────────────────

ResourceType = Literal[
    "food", "water", "medical", "shelter",
    "rescue_team", "vehicle", "volunteer",
]

ResourceStatus = Literal[
    "available", "deployed", "reserved", "maintenance", "depleted",
]


class ResourceCreate(BaseModel):
    resource_type: ResourceType
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    quantity: int = Field(1, ge=1)
    unit: str = "units"
    status: ResourceStatus = "available"
    owner_org: Optional[str] = None
    contact: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    tags: List[str] = []


class ResourceUpdate(BaseModel):
    quantity: Optional[int] = Field(None, ge=0)
    status: Optional[ResourceStatus] = None
    location_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    deployment_notes: Optional[str] = None
    contact: Optional[str] = None


class ResourceAssign(BaseModel):
    incident_id: str
    deployment_notes: Optional[str] = None
    actor: Optional[str] = "system"


class ResourceOut(BaseModel):
    id: str
    resource_type: str
    name: str
    description: Optional[str] = None
    quantity: int
    unit: str
    status: str
    owner_org: Optional[str] = None
    contact: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    assigned_incident_id: Optional[str] = None
    deployment_notes: Optional[str] = None
    created_at: str
    updated_at: str
    tags: List[str] = []


class PaginatedResources(BaseModel):
    items: List[ResourceOut]
    total: int
    page: int
    per_page: int
    pages: int


# ── Resource Requests ─────────────────────────────────────────────────────────

RequestCategory = Literal[
    "food", "water", "medical", "shelter", "rescue", "other",
]

RequestUrgency = Literal["critical", "high", "medium", "low"]

RequestStatus = Literal[
    "pending", "acknowledged", "in_progress", "fulfilled", "cancelled",
]


class ResourceRequestCreate(BaseModel):
    requester_name: str = Field(..., min_length=2, max_length=200)
    requester_phone: Optional[str] = None
    requester_location: str = Field(..., min_length=2)
    lat: Optional[float] = None
    lng: Optional[float] = None
    category: RequestCategory
    quantity_needed: int = Field(1, ge=1)
    description: str = Field(..., min_length=10)
    incident_id: Optional[str] = None
    urgency: RequestUrgency = "medium"


class ResourceRequestStatusUpdate(BaseModel):
    status: RequestStatus
    responder_notes: Optional[str] = None
    fulfilled_by_resource_id: Optional[str] = None
    actor: Optional[str] = "responder"


class ResourceRequestOut(BaseModel):
    id: str
    requester_name: str
    requester_phone: Optional[str] = None
    requester_location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    category: str
    quantity_needed: int
    description: str
    incident_id: Optional[str] = None
    urgency: str
    status: str
    fulfilled_by_resource_id: Optional[str] = None
    responder_notes: Optional[str] = None
    created_at: str
    updated_at: str
    fulfilled_at: Optional[str] = None


class PaginatedRequests(BaseModel):
    items: List[ResourceRequestOut]
    total: int
    page: int
    per_page: int
    pages: int


# ── Stats ─────────────────────────────────────────────────────────────────────

class ResourceStats(BaseModel):
    total: int
    by_type: Dict[str, int]
    by_status: Dict[str, int]
    deployed_count: int
    available_count: int
    pending_requests: int
    critical_requests: int
    shortages: List[str]  # resource types with 0 available
