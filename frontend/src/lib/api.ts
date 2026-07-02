/**
 * API client — wraps fetch calls to the FastAPI backend.
 * Falls back to rich mock data when the backend is unreachable.
 */
import {
  Incident, Alert, Shelter, RiskSummary, ActionRecommendations,
  PaginatedIncidents, PaginatedAlerts, IncidentAnalytics, TrustResult, AuditLogEntry,
  Resource, ResourceRequest, PaginatedResources, PaginatedRequests, ResourceStats, ResourceType,
} from "@/types";
import type {
  TrendPoint, HotspotCluster, ResourceForecast,
  ShelterForecast, ResponseTimeStats, RiskTimelinePoint, ExecutiveBriefing,
} from "@/types/analytics";
import type { IntelligenceDashboard, IncidentIntelligence } from "@/types/intelligence";
import { MOCK_INCIDENTS, MOCK_ALERTS, MOCK_SHELTERS, MOCK_RESOURCES, MOCK_RESOURCE_REQUESTS } from "./mock-data";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Retrieve the FastAPI Bearer token from the NextAuth session (browser only). */
async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const { getSession } = await import("next-auth/react");
    const session = await getSession() as (Record<string, unknown> & { accessToken?: string }) | null;
    if (session?.accessToken) {
      return { Authorization: `Bearer ${session.accessToken}` };
    }
  } catch {
    // unauthenticated or called during SSR
  }
  return {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export async function fetchIncidents(params?: {
  severity?: string;
  status?: string;
  search?: string;
  limit?: number;
}): Promise<Incident[]> {
  try {
    const q = new URLSearchParams();
    if (params?.severity) q.set("severity", params.severity);
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return await apiFetch<Incident[]>(`/api/incidents${qs ? `?${qs}` : ""}`);
  } catch {
    return MOCK_INCIDENTS;
  }
}

export async function fetchIncidentsAdmin(params: {
  page?: number;
  per_page?: number;
  severity?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
}): Promise<PaginatedIncidents> {
  try {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.severity) q.set("severity", params.severity);
    if (params.status) q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    if (params.sort_by) q.set("sort_by", params.sort_by);
    if (params.sort_dir) q.set("sort_dir", params.sort_dir);
    return await apiFetch<PaginatedIncidents>(`/api/incidents/admin?${q.toString()}`);
  } catch {
    const page = params.page ?? 1;
    const per_page = params.per_page ?? 20;
    const start = (page - 1) * per_page;
    const items = MOCK_INCIDENTS.slice(start, start + per_page);
    return { items, total: MOCK_INCIDENTS.length, page, per_page, pages: Math.ceil(MOCK_INCIDENTS.length / per_page) };
  }
}

export async function fetchIncidentAnalytics(): Promise<IncidentAnalytics> {
  try {
    return await apiFetch<IncidentAnalytics>("/api/incidents/analytics");
  } catch {
    const items = MOCK_INCIDENTS;
    const by_severity: Record<string, number> = {};
    const by_status: Record<string, number> = {};
    const by_type: Record<string, number> = {};
    for (const inc of items) {
      by_severity[inc.severity] = (by_severity[inc.severity] ?? 0) + 1;
      by_status[inc.status] = (by_status[inc.status] ?? 0) + 1;
      by_type[inc.type] = (by_type[inc.type] ?? 0) + 1;
    }
    return {
      total: items.length,
      by_severity,
      by_status,
      by_type,
      affected_total: items.reduce((s, i) => s + (i.affected_count ?? 0), 0),
    };
  }
}

export async function submitIncident(
  data: Omit<Incident, "id" | "timestamp" | "verified" | "ai_category" | "ai_confidence">
): Promise<Incident> {
  return apiFetch<Incident>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  adminNotes?: string
): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${incidentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, admin_notes: adminNotes }),
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function fetchAlerts(): Promise<Alert[]> {
  try {
    return await apiFetch<Alert[]>("/api/alerts");
  } catch {
    return MOCK_ALERTS;
  }
}

export async function fetchAlertHistory(params?: {
  page?: number;
  per_page?: number;
  severity?: string;
  district?: string;
  active_only?: boolean;
}): Promise<PaginatedAlerts> {
  try {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    if (params?.severity) q.set("severity", params.severity);
    if (params?.district) q.set("district", params.district);
    if (params?.active_only) q.set("active_only", "true");
    return await apiFetch<PaginatedAlerts>(`/api/alerts/history?${q.toString()}`);
  } catch {
    const page = params?.page ?? 1;
    const per_page = params?.per_page ?? 20;
    const items = MOCK_ALERTS.slice((page - 1) * per_page, page * per_page);
    return { items, total: MOCK_ALERTS.length, page, per_page, pages: Math.ceil(MOCK_ALERTS.length / per_page) };
  }
}

export async function triggerAlertForIncident(incidentId: string): Promise<Alert> {
  return apiFetch<Alert>(`/api/alerts/auto-generate/${incidentId}`, { method: "POST" });
}

export async function dismissAlert(alertId: string): Promise<Alert> {
  return apiFetch<Alert>(`/api/alerts/${alertId}/dismiss`, { method: "PATCH" });
}

// ── Resources ─────────────────────────────────────────────────────────────────

export async function fetchShelters(): Promise<Shelter[]> {
  try {
    return await apiFetch<Shelter[]>("/api/resources");
  } catch {
    return MOCK_SHELTERS;
  }
}

export async function fetchNearestShelters(lat: number, lng: number, limit = 3): Promise<Shelter[]> {
  try {
    return await apiFetch<Shelter[]>(`/api/resources/nearest?lat=${lat}&lng=${lng}&limit=${limit}`);
  } catch {
    return MOCK_SHELTERS.slice(0, limit);
  }
}

// ── AI ────────────────────────────────────────────────────────────────────────

export async function fetchRiskSummary(): Promise<RiskSummary> {
  try {
    return await apiFetch<RiskSummary>("/api/ai/risk-summary");
  } catch {
    return {
      overall_risk_level: "HIGH",
      executive_summary:
        "Nairobi is currently experiencing multiple concurrent emergencies including flash flooding in Westlands, a mass casualty event in Kibera, and water contamination in Mathare Valley. Coordinated multi-agency response is underway.",
      key_threats: ["Flash Flooding", "Mass Casualty / Gas Explosion", "Water Contamination"],
      population_at_risk: 14218,
      incident_hotspots: ["Westlands", "Kibera", "Mathare"],
      forecast: "Rainfall expected to continue for 6–8 hours. Flood risk remains elevated in low-lying areas. Medical situation at Kibera stabilising with MSF on scene.",
      immediate_priorities: [
        "Medical triage at Kibera Market",
        "Flood barrier deployment in Westlands",
        "Water distribution in Mathare Valley",
      ],
      generated_at: new Date().toISOString(),
    };
  }
}

export async function generateMultilingualAlert(
  title: string,
  message_en: string
): Promise<Record<string, string>> {
  try {
    return await apiFetch<Record<string, string>>("/api/ai/multilingual-alert", {
      method: "POST",
      body: JSON.stringify({ title, message_en, target_languages: ["sw", "fr", "ar"] }),
    });
  } catch {
    return {
      en: message_en,
      sw: `Onyo la dharura: ${title}. ${message_en}`,
      fr: `Alerte d'urgence: ${title}. ${message_en}`,
      ar: `تنبيه طارئ: ${title}. ${message_en}`,
    };
  }
}

export async function fetchActionRecommendations(): Promise<ActionRecommendations> {
  try {
    return await apiFetch<ActionRecommendations>("/api/ai/recommend", { method: "POST", body: JSON.stringify({}) });
  } catch {
    return {
      priority_actions: [
        { priority: 1, action: "Deploy flood response teams to Westlands Underpass", rationale: "Critical flooding blocking major artery with submerged vehicles.", agencies: ["Kenya Red Cross", "NMS"], timeframe: "Immediate" },
        { priority: 2, action: "Mobilise additional medical personnel to KNH Emergency", rationale: "Mass casualty event in Kibera exceeding current capacity.", agencies: ["KNH", "MSF Kenya", "AMREF"], timeframe: "Immediate" },
        { priority: 3, action: "Issue boil-water advisory for Mathare Valley", rationale: "Confirmed water contamination affecting 3,500+ residents.", agencies: ["Nairobi Water", "Ministry of Health"], timeframe: "Within 1 hour" },
        { priority: 4, action: "Open overflow shelter at Ruaraka Community Church", rationale: "Kibera Social Centre at 77% capacity — overflow imminent.", agencies: ["Nairobi County", "UNHCR"], timeframe: "Within 1 hour" },
      ],
      resource_needs: ["5× flood rescue boats", "30× medical triage kits", "50,000L bottled water", "Portable water purification units"],
      coordination_notes: "Incident Command Post recommended at Uhuru Park. NDMA activated at EOCC Level 2. Request mutual aid from Kiambu County for flood response assets.",
    };
  }
}

// ── Trust & Verification ──────────────────────────────────────────────────────

export async function fetchIncidentTrust(incidentId: string): Promise<TrustResult> {
  try {
    return await apiFetch<TrustResult>(`/api/incidents/${incidentId}/trust`);
  } catch {
    return {
      trust_score: 0,
      confidence_level: "low",
      validation_reasons: ["Trust data unavailable — backend may be offline"],
    };
  }
}

export async function recalculateTrust(incidentId: string): Promise<TrustResult> {
  return apiFetch<TrustResult>(`/api/incidents/${incidentId}/trust/recalculate`, {
    method: "POST",
  });
}

export async function overrideTrust(
  incidentId: string,
  data: { trust_score: number; confidence_level: string; notes?: string; actor?: string }
): Promise<TrustResult> {
  return apiFetch<TrustResult>(`/api/incidents/${incidentId}/trust/override`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchAuditLog(incidentId: string): Promise<AuditLogEntry[]> {
  try {
    return await apiFetch<AuditLogEntry[]>(`/api/incidents/${incidentId}/audit`);
  } catch {
    return [];
  }
}

// ── Intelligence ──────────────────────────────────────────────────────────────

const MOCK_INTEL_DASHBOARD: IntelligenceDashboard = {
  weather: {
    source: "mock_weather", provider_type: "weather",
    lat: -1.2921, lng: 36.8219,
    temperature: 21.6, humidity: 82.0, wind_speed: 4.8, wind_direction: 155.0,
    precipitation_mm: 14.2, weather_code: 501, weather_description: "Moderate rain",
    observed_at: new Date().toISOString(),
  },
  climate: {
    source: "mock_nasa_power", provider_type: "climate",
    lat: -1.2921, lng: 36.8219,
    temperature: 20.8, humidity: 79.0, wind_speed: 3.9, precipitation_mm: 11.3,
    solar_irradiance: 142.5, soil_moisture: 0.38,
    observed_at: new Date().toISOString(),
  },
  fire_hotspot_count: 2,
  fire_hotspots: [
    {
      source: "mock_firms", provider_type: "fire_hotspot",
      lat: -1.3167, lng: 36.7845,
      fire_radiative_power: 58.7, brightness: 319.2, fire_confidence: "high",
      observed_at: new Date(Date.now() - 82 * 60000).toISOString(),
    },
    {
      source: "mock_firms", provider_type: "fire_hotspot",
      lat: -1.2480, lng: 36.7542,
      fire_radiative_power: 22.4, brightness: 304.1, fire_confidence: "nominal",
      observed_at: new Date(Date.now() - 225 * 60000).toISOString(),
    },
  ],
  observation_counts: { weather: 1, climate: 1, fire_hotspot: 2 },
  data_sources_active: ["Weather (Mock)", "Climate (Mock)", "Fire Hotspots (Mock)"],
  last_updated: new Date().toISOString(),
  mode: "mock",
};

export async function fetchIntelligenceDashboard(): Promise<IntelligenceDashboard> {
  try {
    return await apiFetch<IntelligenceDashboard>("/api/intelligence/dashboard");
  } catch {
    return MOCK_INTEL_DASHBOARD;
  }
}

export async function analyzeIncidentIntelligence(
  incidentId: string
): Promise<IncidentIntelligence> {
  try {
    return await apiFetch<IncidentIntelligence>(
      `/api/intelligence/analyze/${incidentId}`,
      { method: "POST" }
    );
  } catch {
    return {
      incident_id: incidentId,
      analyzed_at: new Date().toISOString(),
      risk_score: 0.72,
      ai_confidence: 0.68,
      summary:
        "Mock analysis: elevated risk based on reported severity and current weather conditions " +
        "(moderate rain 14.2 mm/hr). Two satellite fire hotspots detected within 25 km. " +
        "Recommend field verification by a responder.",
      recommended_actions: [
        "Dispatch assessment team to the incident site",
        "Monitor moderate rain conditions — 14.2 mm/hr precipitation",
        "Alert fire response units — active satellite hotspots nearby",
      ],
      risk_factors: [
        "Reported severity",
        "Weather: Moderate rain (14.2 mm/hr)",
        "Satellite fire hotspot(s) within 25 km",
      ],
      corroboration_level: "low",
      weather: MOCK_INTEL_DASHBOARD.weather,
      fire_hotspot_count: 2,
      nearby_observation_count: 3,
      nearby_report_count: 0,
    };
  }
}

// ── Resource Inventory ────────────────────────────────────────────────────────

export async function fetchResourceInventory(params?: {
  resource_type?: string;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResources> {
  try {
    const q = new URLSearchParams();
    if (params?.resource_type) q.set("resource_type", params.resource_type);
    if (params?.status) q.set("status", params.status);
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    return await apiFetch<PaginatedResources>(`/api/resources/inventory?${q.toString()}`);
  } catch {
    const page = params?.page ?? 1;
    const per_page = params?.per_page ?? 20;
    let items = MOCK_RESOURCES;
    if (params?.resource_type) items = items.filter(r => r.resource_type === params.resource_type);
    if (params?.status) items = items.filter(r => r.status === params.status);
    const sliced = items.slice((page - 1) * per_page, page * per_page);
    return { items: sliced, total: items.length, page, per_page, pages: Math.ceil(items.length / per_page) };
  }
}

export async function fetchResourceStats(): Promise<ResourceStats> {
  try {
    return await apiFetch<ResourceStats>("/api/resources/inventory/stats");
  } catch {
    const by_type: Record<string, number> = {};
    const by_status: Record<string, number> = {};
    for (const r of MOCK_RESOURCES) {
      by_type[r.resource_type] = (by_type[r.resource_type] ?? 0) + 1;
      by_status[r.status] = (by_status[r.status] ?? 0) + 1;
    }
    const available = new Set(MOCK_RESOURCES.filter(r => r.status === "available").map(r => r.resource_type));
    const ALL_TYPES: ResourceType[] = ["food","water","medical","shelter","rescue_team","vehicle","volunteer"];
    const shortages = ALL_TYPES.filter(t => !available.has(t));
    const pendingReqs = MOCK_RESOURCE_REQUESTS.filter(r => r.status === "pending");
    return {
      total: MOCK_RESOURCES.length,
      by_type,
      by_status,
      deployed_count: by_status["deployed"] ?? 0,
      available_count: by_status["available"] ?? 0,
      pending_requests: pendingReqs.length,
      critical_requests: pendingReqs.filter(r => r.urgency === "critical").length,
      shortages,
    };
  }
}

export async function createResource(data: {
  resource_type: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  status?: string;
  owner_org?: string;
  contact?: string;
  lat?: number;
  lng?: number;
  location_name?: string;
  tags?: string[];
}): Promise<Resource> {
  return apiFetch<Resource>("/api/resources/inventory", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateResource(
  resourceId: string,
  data: { quantity?: number; status?: string; location_name?: string; lat?: number; lng?: number; deployment_notes?: string; contact?: string }
): Promise<Resource> {
  return apiFetch<Resource>(`/api/resources/inventory/${resourceId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function assignResource(
  resourceId: string,
  incidentId: string,
  deploymentNotes?: string
): Promise<Resource> {
  return apiFetch<Resource>(`/api/resources/inventory/${resourceId}/assign`, {
    method: "POST",
    body: JSON.stringify({ incident_id: incidentId, deployment_notes: deploymentNotes }),
  });
}

// ── Resource Requests ─────────────────────────────────────────────────────────

export async function fetchResourceRequests(params?: {
  status?: string;
  category?: string;
  urgency?: string;
  incident_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedRequests> {
  try {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.category) q.set("category", params.category);
    if (params?.urgency) q.set("urgency", params.urgency);
    if (params?.incident_id) q.set("incident_id", params.incident_id);
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    return await apiFetch<PaginatedRequests>(`/api/resources/requests?${q.toString()}`);
  } catch {
    const page = params?.page ?? 1;
    const per_page = params?.per_page ?? 20;
    let items = MOCK_RESOURCE_REQUESTS;
    if (params?.status) items = items.filter(r => r.status === params.status);
    if (params?.category) items = items.filter(r => r.category === params.category);
    if (params?.urgency) items = items.filter(r => r.urgency === params.urgency);
    const sliced = items.slice((page - 1) * per_page, page * per_page);
    return { items: sliced, total: items.length, page, per_page, pages: Math.ceil(items.length / per_page) };
  }
}

export async function submitResourceRequest(data: {
  requester_name: string;
  requester_phone?: string;
  requester_location: string;
  lat?: number;
  lng?: number;
  category: string;
  quantity_needed: number;
  description: string;
  incident_id?: string;
  urgency: string;
}): Promise<ResourceRequest> {
  return apiFetch<ResourceRequest>("/api/resources/requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRequestStatus(
  requestId: string,
  data: { status: string; responder_notes?: string; fulfilled_by_resource_id?: string }
): Promise<ResourceRequest> {
  return apiFetch<ResourceRequest>(`/api/resources/requests/${requestId}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────

function _seeded(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function _mockTrends(period: "daily" | "weekly" | "monthly"): TrendPoint[] {
  const slots = period === "daily" ? 30 : period === "weekly" ? 12 : 6;
  const deltaDays = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const now = new Date();
  return Array.from({ length: slots + 1 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (slots - i) * deltaDays);
    const date = d.toISOString().slice(0, 10);
    const s = d.getDate() * 13 + d.getMonth() * 7;
    const count = Math.round(_seeded(s) * 6 + 2);
    const critical = Math.round(_seeded(s + 1) * count * 0.25);
    const high = Math.round(_seeded(s + 2) * count * 0.35);
    const medium = Math.round(_seeded(s + 3) * count * 0.25);
    const low = Math.max(count - critical - high - medium, 0);
    return { date, count, critical, high, medium, low };
  });
}

export async function fetchIncidentTrends(
  period: "daily" | "weekly" | "monthly" = "daily"
): Promise<TrendPoint[]> {
  try {
    const d = await apiFetch<{ period: string; data: TrendPoint[] }>(
      `/api/analytics/trends?period=${period}`
    );
    return d.data;
  } catch {
    return _mockTrends(period);
  }
}

export async function fetchHotspots(): Promise<HotspotCluster[]> {
  try {
    const d = await apiFetch<{ clusters: HotspotCluster[] }>("/api/analytics/hotspots");
    return d.clusters;
  } catch {
    return [
      { lat: -1.2921, lng: 36.8219, radius_km: 3, incident_count: 4, dominant_type: "flood",
        severity_level: "critical", district: "Westlands, Nairobi", total_affected: 183, intensity: 3.5 },
      { lat: -1.3143, lng: 36.7885, radius_km: 3, incident_count: 2, dominant_type: "medical",
        severity_level: "critical", district: "Kibera Market, Nairobi", total_affected: 76, intensity: 3.0 },
      { lat: -1.2857, lng: 36.8183, radius_km: 3, incident_count: 2, dominant_type: "fire",
        severity_level: "high", district: "Kenyatta Avenue, CBD", total_affected: 120, intensity: 2.5 },
    ];
  }
}

export async function fetchResourceForecast(): Promise<ResourceForecast[]> {
  try {
    const d = await apiFetch<{ forecast: ResourceForecast[] }>("/api/analytics/resource-forecast");
    return d.forecast;
  } catch {
    return [
      { resource_type: "rescue_team", current_available: 1, pending_requests: 2, predicted_demand_24h: 4, predicted_demand_72h: 8, shortage_risk: "high" },
      { resource_type: "medical", current_available: 1, pending_requests: 1, predicted_demand_24h: 3, predicted_demand_72h: 6, shortage_risk: "high" },
      { resource_type: "water", current_available: 3, pending_requests: 1, predicted_demand_24h: 3, predicted_demand_72h: 5, shortage_risk: "medium" },
      { resource_type: "food", current_available: 2, pending_requests: 1, predicted_demand_24h: 2, predicted_demand_72h: 3, shortage_risk: "medium" },
      { resource_type: "shelter", current_available: 2, pending_requests: 0, predicted_demand_24h: 1, predicted_demand_72h: 2, shortage_risk: "low" },
      { resource_type: "vehicle", current_available: 1, pending_requests: 0, predicted_demand_24h: 1, predicted_demand_72h: 2, shortage_risk: "low" },
      { resource_type: "volunteer", current_available: 1, pending_requests: 0, predicted_demand_24h: 0, predicted_demand_72h: 0, shortage_risk: "low" },
    ];
  }
}

export async function fetchShelterForecast(): Promise<ShelterForecast[]> {
  try {
    const d = await apiFetch<{ forecast: ShelterForecast[] }>("/api/analytics/shelter-forecast");
    return d.forecast;
  } catch {
    return [
      { shelter_id: "sh-001", name: "Westlands Community Hall", current_occupancy: 180, capacity: 250, current_pct: 72, predicted_pct_24h: 92, status: "nearly_full" },
      { shelter_id: "sh-002", name: "Kibera Primary School", current_occupancy: 210, capacity: 300, current_pct: 70, predicted_pct_24h: 89, status: "open" },
      { shelter_id: "sh-003", name: "St. Peter's Church Hall", current_occupancy: 80, capacity: 150, current_pct: 53, predicted_pct_24h: 65, status: "open" },
    ];
  }
}

export async function fetchResponseTime(): Promise<ResponseTimeStats> {
  try {
    return await apiFetch<ResponseTimeStats>("/api/analytics/response-time");
  } catch {
    return {
      by_severity: {
        critical: { count: 2, avg_hours: 1.8, p50_hours: 1.6, p90_hours: 2.5 },
        high: { count: 3, avg_hours: 4.2, p50_hours: 4.0, p90_hours: 6.1 },
        medium: { count: 1, avg_hours: 9.5, p50_hours: 9.5, p90_hours: 12.0 },
        low: { count: 0, avg_hours: 24.0, p50_hours: 24.0, p90_hours: 33.6 },
      },
      total_resolved: 6,
      total_active: 7,
      resolution_rate_pct: 46,
    };
  }
}

export async function fetchRiskTimeline(days: number = 7): Promise<RiskTimelinePoint[]> {
  try {
    const d = await apiFetch<{ timeline: RiskTimelinePoint[] }>(
      `/api/analytics/risk-timeline?days=${days}`
    );
    return d.timeline;
  } catch {
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const s = d.getDate() * 17;
      const inc = Math.round(_seeded(s) * 5 + 1);
      const crit = Math.round(_seeded(s + 1) * inc * 0.3);
      return {
        date: d.toISOString().slice(0, 10),
        risk_score: crit * 10 + (inc - crit) * 4,
        incident_count: inc,
        critical_count: crit,
      };
    });
  }
}

// ── AI Settings ───────────────────────────────────────────────────────────────

import type { AISettings, AITestResult } from "@/types";

export async function fetchAISettings(): Promise<AISettings> {
  return apiFetch<AISettings>("/api/ai/settings");
}

export interface AISettingsInput {
  provider: string;
  model: string;
  /** Empty string = keep the existing key on the backend unchanged. */
  api_key: string;
  base_url: string;
}

export async function saveAISettings(data: AISettingsInput): Promise<AISettings> {
  return apiFetch<AISettings>("/api/ai/settings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function testAIConnection(): Promise<AITestResult> {
  return apiFetch<AITestResult>("/api/ai/test", { method: "POST" });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function fetchExecutiveBriefing(): Promise<ExecutiveBriefing> {
  try {
    return await apiFetch<ExecutiveBriefing>("/api/analytics/briefing");
  } catch {
    return {
      generated_at: new Date().toISOString(),
      overall_risk: "HIGH",
      summary:
        "Sentinel AI reports 7 active incidents affecting approximately 2,883 people. " +
        "3 critical and 3 high-priority incidents require immediate coordinated response " +
        "across Westlands and Kibera districts.",
      immediate_actions: [
        "Mobilise rescue teams to Westlands Underpass flood zone",
        "Address rescue_team and medical resource shortages urgently",
        "Coordinate with Kenya Red Cross and county health services",
      ],
      key_threats: [
        "3 critical incidents with 2,883 people directly affected",
        "Resource shortfalls: rescue team, medical",
      ],
      recommended_preposition: [
        "Pre-position rescue team units near Westlands, Nairobi",
        "Pre-position medical units near Kibera Market, Nairobi",
      ],
      high_risk_districts: ["Westlands, Nairobi", "Kibera Market, Nairobi", "Kenyatta Avenue, CBD"],
      resource_gaps: ["rescue_team", "medical"],
      ai_narrative:
        "Briefing as of today. The Nairobi metropolitan area is assessed at HIGH risk " +
        "with 7 unresolved incidents. Critical concentrations identified in Westlands and Kibera. " +
        "Approximately 2,883 individuals are directly impacted. Acute shortfalls in rescue team " +
        "and medical resources require immediate inter-agency reallocation. Commanders are advised " +
        "to maintain operational tempo and ensure all active critical incidents receive resource " +
        "assignment within the next operational cycle.",
      mode: "heuristic",
    };
  }
}
