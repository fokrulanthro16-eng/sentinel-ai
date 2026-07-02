"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Incident, Shelter, Alert, Resource } from "@/types";
import type { FireHotspot } from "@/types/intelligence";
import { SEVERITY_COLORS, INCIDENT_ICONS, formatRelativeTime } from "@/lib/utils";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function shelterIcon(status: string) {
  const borderColor = status === "open" ? "#22c55e" : status === "nearly_full" ? "#f97316" : "#ef4444";
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#1e293b;border:2px solid ${borderColor};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 10px rgba(0,0,0,0.5)">🏠</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function AutoFitBounds({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  useEffect(() => {
    if (incidents.length === 0) return;
    const bounds = L.latLngBounds(incidents.map((i) => [i.lat, i.lng]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [incidents, map]);
  return null;
}

const ALERT_RADIUS_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

const RESOURCE_TYPE_EMOJI: Record<string, string> = {
  food: "🍱",
  water: "💧",
  medical: "🏥",
  shelter: "⛺",
  rescue_team: "🚒",
  vehicle: "🚐",
  volunteer: "🙋",
};

function resourceIcon(type: string, status: string) {
  const emoji = RESOURCE_TYPE_EMOJI[type] ?? "📦";
  const border = status === "available" ? "#22c55e" : status === "deployed" ? "#3b82f6" : "#f97316";
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#1e293b;border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 8px rgba(0,0,0,0.5)">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

interface RiskMapProps {
  incidents: Incident[];
  shelters: Shelter[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  fireHotspots?: FireHotspot[];
  alerts?: Alert[];
  resources?: Resource[];
}

const SEVERITY_RADIUS: Record<string, number> = { critical: 18, high: 14, medium: 10, low: 7 };
const SEVERITY_PULSE_RADIUS: Record<string, number> = { critical: 32, high: 24 };

const HOTSPOT_CONFIDENCE_COLOR: Record<string, string> = {
  high:    "#ef4444",
  nominal: "#f97316",
  low:     "#eab308",
};

export default function RiskMap({
  incidents,
  shelters,
  center = [-1.2921, 36.8219],
  zoom = 12,
  height = "100%",
  fireHotspots = [],
  alerts = [],
  resources = [],
}: RiskMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: "100%" }}
      zoomControl={true}
    >
      {/* Dark CartoDB tiles — matches the dark UI theme */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      <AutoFitBounds incidents={incidents} />

      {/* Alert radius circles */}
      {alerts
        .filter((a) => a.active && a.lat != null && a.lng != null && a.radius_km != null)
        .map((alert) => (
          <Circle
            key={`alert-radius-${alert.id}`}
            center={[alert.lat!, alert.lng!]}
            radius={(alert.radius_km ?? 2.5) * 1000}
            pathOptions={{
              color: ALERT_RADIUS_COLORS[alert.severity] ?? "#eab308",
              fillColor: ALERT_RADIUS_COLORS[alert.severity] ?? "#eab308",
              fillOpacity: 0.06,
              weight: 2,
              opacity: 0.55,
              dashArray: "6 4",
            }}
          >
            <Popup maxWidth={260}>
              <div style={{ fontFamily: "inherit", fontSize: "13px" }}>
                <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#e2e8f0" }}>
                  🔔 {alert.title}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#cbd5e1" }}>
                  {alert.message_en}
                </p>
                <p style={{ margin: "0", fontSize: "11px", color: "#94a3b8" }}>
                  Radius: {alert.radius_km} km · {alert.severity.toUpperCase()}
                </p>
              </div>
            </Popup>
          </Circle>
        ))}

      {/* Outer pulse ring for critical/high incidents */}
      {incidents
        .filter((i) => i.severity === "critical" || i.severity === "high")
        .map((inc) => (
          <CircleMarker
            key={`pulse-${inc.id}`}
            center={[inc.lat, inc.lng]}
            radius={SEVERITY_PULSE_RADIUS[inc.severity] ?? 0}
            pathOptions={{
              color: SEVERITY_COLORS[inc.severity],
              fillColor: SEVERITY_COLORS[inc.severity],
              fillOpacity: 0.08,
              weight: 1.5,
              opacity: 0.35,
            }}
          />
        ))}

      {/* Incident markers */}
      {incidents.map((inc) => (
        <CircleMarker
          key={inc.id}
          center={[inc.lat, inc.lng]}
          radius={SEVERITY_RADIUS[inc.severity] ?? 8}
          pathOptions={{
            color: SEVERITY_COLORS[inc.severity],
            fillColor: SEVERITY_COLORS[inc.severity],
            fillOpacity: 0.88,
            weight: 2,
          }}
        >
          <Popup maxWidth={290} className="sentinel-popup">
            <div style={{ fontFamily: "inherit", fontSize: "13px", lineHeight: 1.5 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "20px", lineHeight: 1 }}>{INCIDENT_ICONS[inc.type] ?? "📍"}</span>
                <div>
                  <p style={{ fontWeight: 600, margin: 0, color: "#e2e8f0" }}>{inc.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>{inc.location_name}</p>
                </div>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#cbd5e1" }}>{inc.description}</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    background: SEVERITY_COLORS[inc.severity],
                    color: "#fff",
                    borderRadius: "9999px",
                    padding: "1px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}
                >
                  {inc.severity.toUpperCase()}
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "capitalize" }}>
                  {inc.status}
                </span>
                {inc.affected_count != null && (
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {inc.affected_count.toLocaleString()} affected
                  </span>
                )}
                {inc.verified && (
                  <span style={{ fontSize: "11px", color: "#22c55e" }}>✓ Verified</span>
                )}
              </div>
              {inc.ai_category && (
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#60a5fa" }}>
                  🤖 {inc.ai_category}
                  {inc.ai_confidence != null ? ` (${Math.round(inc.ai_confidence * 100)}% confidence)` : ""}
                </p>
              )}
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>
                {formatRelativeTime(inc.timestamp)}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Fire hotspot overlay — outer glow ring */}
      {fireHotspots.map((h, i) => (
        <CircleMarker
          key={`hotspot-glow-${i}`}
          center={[h.lat, h.lng]}
          radius={22}
          pathOptions={{
            color: HOTSPOT_CONFIDENCE_COLOR[h.fire_confidence] ?? "#f97316",
            fillColor: HOTSPOT_CONFIDENCE_COLOR[h.fire_confidence] ?? "#f97316",
            fillOpacity: 0.06,
            weight: 1,
            opacity: 0.25,
          }}
        />
      ))}

      {/* Fire hotspot markers */}
      {fireHotspots.map((h, i) => (
        <CircleMarker
          key={`hotspot-${i}`}
          center={[h.lat, h.lng]}
          radius={9}
          pathOptions={{
            color: HOTSPOT_CONFIDENCE_COLOR[h.fire_confidence] ?? "#f97316",
            fillColor: HOTSPOT_CONFIDENCE_COLOR[h.fire_confidence] ?? "#f97316",
            fillOpacity: 0.80,
            weight: 2,
          }}
        >
          <Popup maxWidth={220}>
            <div style={{ fontFamily: "inherit", fontSize: "13px" }}>
              <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#e2e8f0" }}>
                🔥 Satellite Fire Hotspot
              </p>
              <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#94a3b8" }}>
                {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
              </p>
              <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#fed7aa" }}>
                FRP: {h.fire_radiative_power.toFixed(1)} MW · {h.brightness.toFixed(0)} K
              </p>
              <p style={{ margin: "0", fontSize: "11px", color: "#94a3b8" }}>
                Confidence: <span style={{ color: HOTSPOT_CONFIDENCE_COLOR[h.fire_confidence], fontWeight: 700 }}>
                  {h.fire_confidence}
                </span>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#64748b" }}>
                Source: {h.source}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Resource markers (have lat/lng, non-shelter types to avoid double-marking) */}
      {resources
        .filter((r) => r.lat != null && r.lng != null && r.resource_type !== "shelter")
        .map((r) => (
          <Marker key={r.id} position={[r.lat!, r.lng!]} icon={resourceIcon(r.resource_type, r.status)}>
            <Popup maxWidth={240}>
              <div style={{ fontFamily: "inherit", fontSize: "13px" }}>
                <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#e2e8f0" }}>
                  {RESOURCE_TYPE_EMOJI[r.resource_type] ?? "📦"} {r.name}
                </p>
                <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#94a3b8" }}>
                  {r.resource_type.replace(/_/g, " ")} · {r.status}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#cbd5e1" }}>
                  {r.quantity.toLocaleString()} {r.unit}
                </p>
                {r.owner_org && (
                  <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#94a3b8" }}>{r.owner_org}</p>
                )}
                {r.assigned_incident_id && (
                  <p style={{ margin: "0", fontSize: "11px", color: "#60a5fa" }}>→ {r.assigned_incident_id}</p>
                )}
                {r.location_name && (
                  <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#64748b" }}>{r.location_name}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Shelter markers */}
      {shelters.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={shelterIcon(s.status)}>
          <Popup maxWidth={240}>
            <div style={{ fontFamily: "inherit", fontSize: "13px" }}>
              <p style={{ fontWeight: 600, margin: "0 0 2px", color: "#e2e8f0" }}>{s.name}</p>
              <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#94a3b8" }}>{s.address}</p>
              <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#cbd5e1" }}>
                {s.current_occupancy}/{s.capacity} occupied
                <span
                  style={{
                    marginLeft: "6px",
                    padding: "1px 6px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    background:
                      s.status === "open" ? "#22c55e22" :
                      s.status === "nearly_full" ? "#f9731622" : "#ef444422",
                    color:
                      s.status === "open" ? "#22c55e" :
                      s.status === "nearly_full" ? "#f97316" : "#ef4444",
                  }}
                >
                  {s.status.replace(/_/g, " ")}
                </span>
              </p>
              {s.notes && (
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                  {s.notes}
                </p>
              )}
              {s.contact && (
                <a
                  href={`tel:${s.contact}`}
                  style={{ fontSize: "11px", color: "#60a5fa", display: "block" }}
                >
                  📞 {s.contact}
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
