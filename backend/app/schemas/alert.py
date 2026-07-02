from pydantic import BaseModel
from typing import Dict, List, Optional, Literal


class AlertCreate(BaseModel):
    title: str
    message_en: str
    severity: Literal["critical", "high", "medium", "low"]
    category: str
    affected_areas: List[str] = []
    source: str = "Sentinel AI System"
    ai_generated: bool = False
    incident_id: Optional[str] = None
    radius_km: Optional[float] = None
    recommended_actions: List[str] = []
    evacuation_guidance: Optional[str] = None
    public_safety_message: Optional[str] = None
    districts: List[str] = []


class AlertOut(BaseModel):
    id: str
    title: str
    message_en: str
    message_sw: Optional[str] = None
    message_fr: Optional[str] = None
    message_ar: Optional[str] = None
    severity: str
    category: str
    issued_at: str
    expires_at: Optional[str] = None
    affected_areas: List[str] = []
    source: str
    ai_generated: bool = False
    active: bool = True
    # Extended fields (all optional for backward compat with sample data)
    incident_id: Optional[str] = None
    notification_channels: List[str] = []
    delivery_status: Dict[str, str] = {}
    radius_km: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    recommended_actions: List[str] = []
    evacuation_guidance: Optional[str] = None
    public_safety_message: Optional[str] = None
    districts: List[str] = []


class PaginatedAlerts(BaseModel):
    items: List[AlertOut]
    total: int
    page: int
    per_page: int
    pages: int
