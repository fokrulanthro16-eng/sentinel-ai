export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentStatus =
  | "pending"
  | "active"
  | "monitoring"
  | "verified"
  | "in_progress"
  | "resolved";
export type IncidentType =
  | "flood"
  | "fire"
  | "medical"
  | "infrastructure"
  | "civil_unrest"
  | "contamination"
  | "power_outage"
  | "landslide"
  | "other";

export type ConfidenceLevel = "low" | "medium" | "high" | "verified_candidate";

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  lat: number;
  lng: number;
  location_name: string;
  reporter_name?: string;
  reporter_phone?: string;
  reporter_id?: string;
  affected_count?: number;
  timestamp: string;
  ai_category?: string;
  ai_confidence?: number;
  verified: boolean;
  admin_notes?: string;
  trust_score?: number;
  confidence_level?: ConfidenceLevel;
  validation_reasons?: string[];
}

export interface TrustResult {
  trust_score: number;
  confidence_level: ConfidenceLevel;
  validation_reasons: string[];
}

export interface AuditLogEntry {
  id: string;
  incident_id: string;
  action: string;
  actor?: string;
  previous_status?: string;
  new_status?: string;
  trust_score_before?: number;
  trust_score_after?: number;
  confidence_before?: string;
  confidence_after?: string;
  notes?: string;
  timestamp: string;
}

export interface PaginatedIncidents {
  items: Incident[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface IncidentAnalytics {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  affected_total: number;
}

export interface Alert {
  id: string;
  title: string;
  message_en: string;
  message_sw?: string;
  message_fr?: string;
  message_ar?: string;
  severity: Severity;
  category: string;
  issued_at: string;
  expires_at?: string;
  affected_areas: string[];
  source: string;
  ai_generated: boolean;
  active: boolean;
  incident_id?: string;
  notification_channels: string[];
  delivery_status: Record<string, string>;
  radius_km?: number;
  lat?: number;
  lng?: number;
  recommended_actions: string[];
  evacuation_guidance?: string;
  public_safety_message?: string;
  districts: string[];
}

export interface PaginatedAlerts {
  items: Alert[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Shelter {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address: string;
  capacity: number;
  current_occupancy: number;
  amenities: string[];
  contact?: string;
  status: "open" | "nearly_full" | "full" | "closed";
  notes?: string;
}

export type ResourceType =
  | "food" | "water" | "medical" | "shelter"
  | "rescue_team" | "vehicle" | "volunteer";

export type ResourceStatus =
  | "available" | "deployed" | "reserved" | "maintenance" | "depleted";

export type RequestCategory =
  | "food" | "water" | "medical" | "shelter" | "rescue" | "other";

export type RequestUrgency = "critical" | "high" | "medium" | "low";

export type RequestStatus =
  | "pending" | "acknowledged" | "in_progress" | "fulfilled" | "cancelled";

export interface Resource {
  id: string;
  resource_type: ResourceType;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  status: ResourceStatus;
  owner_org?: string;
  contact?: string;
  lat?: number;
  lng?: number;
  location_name?: string;
  assigned_incident_id?: string;
  deployment_notes?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface PaginatedResources {
  items: Resource[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ResourceRequest {
  id: string;
  requester_name: string;
  requester_phone?: string;
  requester_location: string;
  lat?: number;
  lng?: number;
  category: RequestCategory;
  quantity_needed: number;
  description: string;
  incident_id?: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  fulfilled_by_resource_id?: string;
  responder_notes?: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
}

export interface PaginatedRequests {
  items: ResourceRequest[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ResourceStats {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  deployed_count: number;
  available_count: number;
  pending_requests: number;
  critical_requests: number;
  shortages: string[];
}

export interface RiskSummary {
  overall_risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  executive_summary: string;
  key_threats: string[];
  population_at_risk: number;
  incident_hotspots: string[];
  forecast: string;
  immediate_priorities: string[];
  generated_at: string;
}

export interface ActionRecommendations {
  priority_actions: {
    priority: number;
    action: string;
    rationale: string;
    agencies: string[];
    timeframe: string;
  }[];
  resource_needs: string[];
  coordination_notes: string;
}

export type AIProvider =
  | "mock"
  | "gemini"
  | "openai"
  | "anthropic"
  | "ollama"
  | "lmstudio";

export interface AISettings {
  provider: AIProvider;
  model: string;
  api_key_configured: boolean;
  base_url: string;
  providers: AIProvider[];
}

export interface AITestResult {
  success: boolean;
  provider: string;
  model: string;
  latency_ms: number;
  message?: string;
  error?: string;
}
