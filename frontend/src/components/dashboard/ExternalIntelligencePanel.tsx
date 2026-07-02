"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Satellite, Thermometer, Droplets, Wind, Flame,
  Sun, RefreshCw, Loader2, AlertTriangle, Cloud,
  CheckCircle2, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchIntelligenceDashboard } from "@/lib/api";
import type { IntelligenceDashboard } from "@/types/intelligence";
import { cn, formatRelativeTime } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function weatherEmoji(code: number): string {
  if (code >= 200 && code < 300) return "⛈️";
  if (code >= 300 && code < 400) return "🌦️";
  if (code >= 500 && code < 600) return "🌧️";
  if (code >= 600 && code < 700) return "❄️";
  if (code >= 700 && code < 800) return "🌫️";
  if (code === 800) return "☀️";
  if (code === 801) return "🌤️";
  if (code === 802) return "⛅";
  if (code >= 803) return "☁️";
  return "🌡️";
}

function windCompass(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function confidenceColor(conf: string): string {
  return conf === "high" ? "text-red-400" : conf === "nominal" ? "text-orange-400" : "text-yellow-400";
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ExternalIntelligencePanel() {
  const [data, setData]       = useState<IntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = await fetchIntelligenceDashboard();
      setData(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const w = data?.weather;
  const c = data?.climate;
  const isMock = data?.mode === "mock";

  return (
    <Card className="border-blue-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Satellite className="h-4 w-4 text-blue-400" />
          External Intelligence
          <span className={cn(
            "ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
            isMock
              ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
              : "text-green-400 border-green-500/30 bg-green-500/10"
          )}>
            {isMock ? "MOCK DATA" : "LIVE"}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh intelligence data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Fetching intelligence data…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Info className="h-4 w-4 text-yellow-400 shrink-0" />
            Intelligence service unavailable — using mock fallback.
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Weather section ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5" />
                Current Weather
                <span className="ml-auto text-[10px] normal-case tracking-normal font-normal text-muted-foreground/60">
                  {w?.source ?? "—"}
                </span>
              </p>

              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl leading-none">{w ? weatherEmoji(w.weather_code) : "🌡️"}</span>
                <div>
                  <p className="font-semibold text-foreground">{w?.weather_description ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Nairobi metro area</p>
                </div>
                {w?.temperature != null && (
                  <p className="ml-auto text-2xl font-bold text-blue-400">
                    {w.temperature.toFixed(1)}°C
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                  <Droplets className="h-3.5 w-3.5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{w?.humidity?.toFixed(0) ?? "—"}%</p>
                  <p className="text-[10px] text-muted-foreground">Humidity</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                  <Wind className="h-3.5 w-3.5 text-cyan-400 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">
                    {w?.wind_speed?.toFixed(1) ?? "—"} m/s
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {w?.wind_direction != null ? windCompass(w.wind_direction) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                  <Droplets className="h-3.5 w-3.5 text-indigo-400 mx-auto mb-1" />
                  <p className={cn(
                    "text-xs font-semibold",
                    (w?.precipitation_mm ?? 0) > 5 ? "text-orange-400" : "text-foreground"
                  )}>
                    {w?.precipitation_mm?.toFixed(1) ?? "0.0"} mm/hr
                  </p>
                  <p className="text-[10px] text-muted-foreground">Precip.</p>
                </div>
              </div>

              {(w?.precipitation_mm ?? 0) > 5 && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-orange-500/20 bg-orange-500/10 px-2.5 py-1.5 text-xs text-orange-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Elevated precipitation — increased flood risk in low-lying areas
                </div>
              )}
            </div>

            {/* ── NASA POWER climate row ── */}
            {c && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5" />
                  Climate (NASA POWER)
                  <span className="ml-auto text-[10px] normal-case tracking-normal font-normal text-muted-foreground/60">
                    {c.source}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {c.solar_irradiance != null && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sun className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Solar: <span className="font-medium text-foreground">{c.solar_irradiance.toFixed(0)} W/m²</span></span>
                    </div>
                  )}
                  {c.soil_moisture != null && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Droplets className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      <span>Soil: <span className="font-medium text-foreground">{(c.soil_moisture * 100).toFixed(0)}% sat.</span></span>
                    </div>
                  )}
                  {c.precipitation_mm != null && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Thermometer className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>7d avg precip: <span className="font-medium text-foreground">{c.precipitation_mm.toFixed(1)} mm/d</span></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Fire hotspots ── */}
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                Satellite Fire Hotspots
                <span className={cn(
                  "ml-2 text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full",
                  (data.fire_hotspot_count ?? 0) > 0
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-secondary text-muted-foreground"
                )}>
                  {data.fire_hotspot_count ?? 0}
                </span>
                <span className="ml-auto text-[10px] normal-case tracking-normal font-normal text-muted-foreground/60">
                  NASA FIRMS · 25 km radius
                </span>
              </p>

              {(data.fire_hotspots ?? []).length > 0 ? (
                <div className="space-y-1.5">
                  {data.fire_hotspots.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-orange-500/20 bg-orange-500/5 px-2.5 py-1.5 text-xs">
                      <Flame className="h-3 w-3 text-orange-400 shrink-0" />
                      <span className="text-muted-foreground">
                        {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
                      </span>
                      <span className="ml-auto font-medium text-orange-300">
                        {h.fire_radiative_power.toFixed(0)} MW
                      </span>
                      <span className={cn("font-semibold", confidenceColor(h.fire_confidence))}>
                        {h.fire_confidence}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  No active fire hotspots detected within 25 km
                </div>
              )}
            </div>

            {/* ── Data source badges ── */}
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Active Data Sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(data.data_sources_active ?? []).map((src) => (
                  <span
                    key={src}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      src.includes("Mock")
                        ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-500/80"
                        : "border-green-500/20 bg-green-500/5 text-green-400"
                    )}
                  >
                    {src.includes("Mock") ? "⚡" : "✓"} {src}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Last updated: {data.last_updated ? formatRelativeTime(data.last_updated) : "—"}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
