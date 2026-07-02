"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchIncidents, fetchShelters, fetchIntelligenceDashboard, fetchAlerts, fetchResourceInventory } from "@/lib/api";
import { Incident, Shelter, Alert, Resource, Severity } from "@/types";
import type { IntelligenceDashboard } from "@/types/intelligence";
import { INCIDENT_ICONS, SEVERITY_COLORS, formatRelativeTime } from "@/lib/utils";
import { Loader2, Satellite, Thermometer, Droplets, Wind, Flame } from "lucide-react";
import { useRealtime } from "@/contexts/RealtimeContext";
import ConnectionStatus from "@/components/shared/ConnectionStatus";

const RiskMap = dynamic(() => import("@/components/map/RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#111827] text-muted-foreground gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading map…
    </div>
  ),
});

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function MapPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [showAlertRadii, setShowAlertRadii] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [showShelters, setShowShelters] = useState(true);
  const [showIntel, setShowIntel] = useState(false);
  const [intelData, setIntelData] = useState<IntelligenceDashboard | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const { subscribe } = useRealtime();

  useEffect(() => {
    Promise.all([
      fetchIncidents(),
      fetchShelters(),
      fetchAlerts(),
      fetchResourceInventory({ per_page: 100 }).then(r => r.items).catch(() => [] as Resource[]),
    ]).then(([inc, shlt, alts, res]) => {
      setIncidents(inc);
      setShelters(shlt);
      setAlerts(alts);
      setResources(res);
      setLoading(false);
    });
  }, []);

  const toggleIntel = async () => {
    const next = !showIntel;
    setShowIntel(next);
    if (next && !intelData) {
      setIntelLoading(true);
      const d = await fetchIntelligenceDashboard();
      setIntelData(d);
      setIntelLoading(false);
    }
  };

  const fireHotspots = showIntel ? (intelData?.fire_hotspots ?? []) : [];

  // Subscribe to live incident, alert, and resource updates
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "incident.created") {
        const inc = msg.incident as Incident;
        setIncidents((prev) =>
          prev.find((i) => i.id === inc.id) ? prev : [inc, ...prev]
        );
      } else if (msg.type === "incident.updated") {
        const inc = msg.incident as Incident;
        setIncidents((prev) =>
          prev.map((i) => (i.id === inc.id ? { ...i, ...inc } : i))
        );
      } else if (msg.type === "alert.created") {
        const alert = msg.alert as Alert;
        setAlerts((prev) =>
          prev.find((a) => a.id === alert.id) ? prev : [alert, ...prev]
        );
      } else if (msg.type === "resource.created") {
        const res = msg.resource as Resource;
        setResources((prev) =>
          prev.find((r) => r.id === res.id) ? prev : [res, ...prev]
        );
      } else if (msg.type === "resource.updated" || msg.type === "resource.assigned") {
        const res = msg.resource as Resource;
        setResources((prev) =>
          prev.map((r) => (r.id === res.id ? { ...r, ...res } : r))
        );
      }
    });
  }, [subscribe]);

  const filtered = filterSeverity === "all"
    ? incidents
    : incidents.filter((i) => i.severity === filterSeverity);

  const counts: Record<string, number> = {};
  for (const inc of incidents) counts[inc.severity] = (counts[inc.severity] ?? 0) + 1;

  const criticalActive = incidents.filter((i) => i.severity === "critical" && i.status === "active").length;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md z-10">
        {/* Live badge */}
        {criticalActive > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-medium text-red-400">{criticalActive} critical</span>
          </div>
        )}

        <span className="text-sm font-medium text-muted-foreground shrink-0">Severity:</span>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterSeverity("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              filterSeverity === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            All ({incidents.length})
          </button>
          {SEVERITY_ORDER.map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
              style={{
                background: filterSeverity === sev ? SEVERITY_COLORS[sev] + "33" : "transparent",
                borderColor: filterSeverity === sev ? SEVERITY_COLORS[sev] : "hsl(var(--border))",
                color: filterSeverity === sev ? SEVERITY_COLORS[sev] : "hsl(var(--muted-foreground))",
              }}
            >
              {SEVERITY_LABELS[sev]} ({counts[sev] ?? 0})
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4">
          {/* Visible count */}
          <span className="text-xs text-muted-foreground hidden sm:block">
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> incident{filtered.length !== 1 ? "s" : ""}
            {showShelters && shelters.length > 0 && (
              <> · <span className="font-semibold text-foreground">{shelters.length}</span> shelters</>
            )}
          </span>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={showShelters}
              onChange={(e) => setShowShelters(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span className="text-muted-foreground">Shelters 🏠</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={showAlertRadii}
              onChange={(e) => setShowAlertRadii(e.target.checked)}
              className="rounded accent-red-500"
            />
            <span className="text-muted-foreground">Alert Zones 🔔</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={showResources}
              onChange={(e) => setShowResources(e.target.checked)}
              className="rounded accent-green-500"
            />
            <span className="text-muted-foreground">Resources 📦</span>
          </label>

          <button
            onClick={toggleIntel}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              showIntel
                ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {intelLoading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Satellite className="h-3 w-3" />
            }
            Intel
          </button>

          <div className="hidden sm:flex items-center border-l border-border pl-4">
            <ConnectionStatus />
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <RiskMap
          incidents={filtered}
          shelters={showShelters ? shelters : []}
          fireHotspots={fireHotspots}
          alerts={showAlertRadii ? alerts : []}
          resources={showResources ? resources : []}
          height="100%"
        />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Fetching incident data…</span>
            </div>
          </div>
        )}

        {/* Intelligence weather overlay — shown when Intel toggle is active */}
        {showIntel && intelData && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] rounded-xl border border-blue-500/30 bg-background/95 backdrop-blur-md p-3 shadow-xl min-w-[280px]">
            <div className="flex items-center gap-2 mb-2">
              <Satellite className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                External Intelligence
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {intelData.mode === "mock" ? "⚡ Mock" : "✓ Live"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Thermometer className="h-3 w-3 text-orange-400 shrink-0" />
                <span>{intelData.weather.temperature?.toFixed(1)}°C — {intelData.weather.weather_description}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Droplets className="h-3 w-3 text-blue-400 shrink-0" />
                <span>{intelData.weather.precipitation_mm?.toFixed(1)} mm/hr rain</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Wind className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>{intelData.weather.wind_speed?.toFixed(1)} m/s wind</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Flame className={`h-3 w-3 shrink-0 ${intelData.fire_hotspot_count > 0 ? "text-orange-400" : "text-muted-foreground/40"}`} />
                <span className={intelData.fire_hotspot_count > 0 ? "text-orange-400 font-medium" : ""}>
                  {intelData.fire_hotspot_count} fire hotspot{intelData.fire_hotspot_count !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Severity legend */}
        <div className="absolute bottom-6 left-4 z-[1000] rounded-xl border border-border bg-background/95 backdrop-blur-md p-3 space-y-1.5 shadow-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legend</p>
          {SEVERITY_ORDER.map((sev) => (
            <div
              key={sev}
              className="flex items-center gap-2 text-xs cursor-pointer"
              onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}
            >
              <span
                className="h-3 w-3 rounded-full inline-block shrink-0"
                style={{ background: SEVERITY_COLORS[sev], boxShadow: `0 0 6px ${SEVERITY_COLORS[sev]}88` }}
              />
              <span className={`capitalize ${filterSeverity === sev ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {sev}
              </span>
              {counts[sev] > 0 && (
                <span className="ml-auto text-xs font-bold" style={{ color: SEVERITY_COLORS[sev] }}>
                  {counts[sev]}
                </span>
              )}
            </div>
          ))}
          <div className="border-t border-border pt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-base">🏠</span>
            <span>Shelter</span>
          </div>
          {showResources && resources.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-base">📦</span>
              <span>Resource ({resources.filter(r => r.lat != null).length})</span>
            </div>
          )}
          {showIntel && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-3 w-3 rounded-full inline-block shrink-0"
                style={{ background: "#f97316", boxShadow: "0 0 6px #f9731688" }}
              />
              <span>Fire Hotspot (Satellite)</span>
            </div>
          )}
          {showAlertRadii && alerts.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-3 w-3 rounded border border-red-500/60 inline-block shrink-0"
                style={{ background: "rgba(239,68,68,0.08)" }}
              />
              <span>Alert Zone</span>
            </div>
          )}
        </div>

        {/* Incident type key */}
        <div className="absolute top-4 right-4 z-[1000] rounded-xl border border-border bg-background/95 backdrop-blur-md p-3 shadow-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Incident Types
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(INCIDENT_ICONS).map(([type, icon]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{icon}</span>
                <span className="capitalize">{type.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
