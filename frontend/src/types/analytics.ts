export interface TrendPoint {
  date: string;
  count: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface HotspotCluster {
  lat: number;
  lng: number;
  radius_km: number;
  incident_count: number;
  dominant_type: string;
  severity_level: string;
  district: string;
  total_affected: number;
  intensity: number;
}

export interface ResourceForecast {
  resource_type: string;
  current_available: number;
  pending_requests: number;
  predicted_demand_24h: number;
  predicted_demand_72h: number;
  shortage_risk: "high" | "medium" | "low";
}

export interface ShelterForecast {
  shelter_id: string;
  name: string;
  current_occupancy: number;
  capacity: number;
  current_pct: number;
  predicted_pct_24h: number;
  status: string;
}

export interface ResponseTimeStats {
  by_severity: Record<string, {
    count: number;
    avg_hours: number;
    p50_hours: number;
    p90_hours: number;
  }>;
  total_resolved: number;
  total_active: number;
  resolution_rate_pct: number;
}

export interface RiskTimelinePoint {
  date: string;
  risk_score: number;
  incident_count: number;
  critical_count: number;
}

export interface ExecutiveBriefing {
  generated_at: string;
  overall_risk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  immediate_actions: string[];
  key_threats: string[];
  recommended_preposition: string[];
  high_risk_districts: string[];
  resource_gaps: string[];
  ai_narrative: string;
  mode?: "ai" | "heuristic";
}
