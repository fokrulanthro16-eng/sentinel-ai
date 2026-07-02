export interface WeatherData {
  source: string;
  provider_type: "weather";
  lat: number;
  lng: number;
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  precipitation_mm: number;
  weather_code: number;
  weather_description: string;
  observed_at: string;
}

export interface ClimateData {
  source: string;
  provider_type: "climate";
  lat: number;
  lng: number;
  temperature: number;
  humidity: number;
  wind_speed: number;
  precipitation_mm: number;
  solar_irradiance?: number;
  soil_moisture?: number;
  observed_at: string;
}

export interface FireHotspot {
  source: string;
  provider_type: "fire_hotspot";
  lat: number;
  lng: number;
  fire_radiative_power: number;
  brightness: number;
  fire_confidence: "low" | "nominal" | "high";
  observed_at: string;
}

export interface IntelligenceDashboard {
  weather: WeatherData;
  climate: ClimateData;
  fire_hotspot_count: number;
  fire_hotspots: FireHotspot[];
  observation_counts: Record<string, number>;
  data_sources_active: string[];
  last_updated: string;
  mode: "mock" | "live";
}

export interface IncidentIntelligence {
  incident_id: string;
  analyzed_at: string;
  risk_score: number;
  ai_confidence: number;
  summary: string;
  recommended_actions: string[];
  risk_factors: string[];
  corroboration_level: "none" | "low" | "medium" | "high";
  weather: WeatherData;
  fire_hotspot_count: number;
  nearby_observation_count: number;
  nearby_report_count: number;
}
