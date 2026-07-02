from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Literal
from datetime import datetime


SeverityLevel = Literal["critical", "high", "medium", "low"]
IncidentStatus = Literal[
    "pending", "active", "monitoring", "verified", "in_progress", "resolved"
]
IncidentType = Literal[
    "flood", "fire", "medical", "infrastructure",
    "civil_unrest", "contamination", "power_outage", "landslide", "other"
]

VALID_STATUSES = {"pending", "active", "monitoring", "verified", "in_progress", "resolved"}


class IncidentCreate(BaseModel):
    type: IncidentType
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    severity: SeverityLevel
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    location_name: str = Field(..., min_length=2, max_length=200)
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_id: Optional[str] = None          # Prisma User.id (optional auth link)
    affected_count: Optional[int] = Field(None, ge=0)


class IncidentOut(BaseModel):
    id: str
    type: str
    title: str
    description: str
    severity: str
    status: str
    lat: float
    lng: float
    location_name: str
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_id: Optional[str] = None
    affected_count: Optional[int] = None
    timestamp: str
    ai_category: Optional[str] = None
    ai_confidence: Optional[float] = None
    verified: bool = False
    admin_notes: Optional[str] = None
    trust_score: Optional[float] = None
    confidence_level: Optional[str] = None
    validation_reasons: Optional[List[str]] = None


class StatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    actor: Optional[str] = None


class TrustResult(BaseModel):
    trust_score: float
    confidence_level: str
    validation_reasons: List[str]


class TrustOverride(BaseModel):
    trust_score: float = Field(..., ge=0, le=100)
    confidence_level: str
    notes: Optional[str] = None
    actor: Optional[str] = "admin"


class AuditLogEntry(BaseModel):
    id: str
    incident_id: str
    action: str
    actor: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    trust_score_before: Optional[float] = None
    trust_score_after: Optional[float] = None
    confidence_before: Optional[str] = None
    confidence_after: Optional[str] = None
    notes: Optional[str] = None
    timestamp: str


class PaginatedIncidents(BaseModel):
    items: List[IncidentOut]
    total: int
    page: int
    per_page: int
    pages: int


class IncidentAnalytics(BaseModel):
    total: int
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    affected_total: int
