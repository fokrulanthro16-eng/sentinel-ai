"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart2, RefreshCw, Download, FileText, Table2,
  AlertTriangle, TrendingUp, Clock, Package, ShieldAlert,
  Loader2, ChevronDown, MapPin, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchIncidentTrends, fetchHotspots, fetchResourceForecast,
  fetchShelterForecast, fetchResponseTime, fetchRiskTimeline,
  fetchExecutiveBriefing,
} from "@/lib/api";
import type {
  TrendPoint, HotspotCluster, ResourceForecast,
  ShelterForecast, ResponseTimeStats, RiskTimelinePoint, ExecutiveBriefing,
} from "@/types/analytics";

// ── Colour maps ──────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};
const RISK_BG: Record<string, string> = {
  CRITICAL: "bg-red-500/10 border-red-500/30",
  HIGH: "bg-orange-500/10 border-orange-500/30",
  MEDIUM: "bg-yellow-500/10 border-yellow-500/30",
  LOW: "bg-green-500/10 border-green-500/30",
};
const SEV_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};
const RISK_BADGE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};
const RESOURCE_EMOJI: Record<string, string> = {
  food: "🍱", water: "💧", medical: "🏥", shelter: "⛺",
  rescue_team: "🚒", vehicle: "🚐", volunteer: "🙋",
};

// ── Export helpers ───────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob), download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function printExecutiveBrief(b: ExecutiveBriefing) {
  const win = window.open("", "_blank", "width=820,height=700");
  if (!win) return;
  const riskColor = RISK_COLORS[b.overall_risk] ?? "#f97316";
  win.document.write(`<!DOCTYPE html><html><head>
<title>Sentinel AI — Executive Briefing</title>
<style>
  body{font-family:Georgia,serif;max-width:780px;margin:40px auto;color:#111;line-height:1.6}
  h1{font-size:22px;border-bottom:3px solid ${riskColor};padding-bottom:8px;margin-bottom:4px}
  .meta{font-size:12px;color:#555;margin-bottom:24px}
  .risk-badge{display:inline-block;padding:3px 14px;border-radius:4px;
    background:${riskColor}22;color:${riskColor};font-weight:700;font-size:14px;border:1px solid ${riskColor}}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.8px;margin-top:24px;color:#333;border-bottom:1px solid #ddd;padding-bottom:4px}
  p{margin:6px 0;font-size:13px}
  ul{margin:6px 0;padding-left:20px}
  li{font-size:13px;margin:4px 0}
  .narrative{background:#f8f8f8;border-left:4px solid ${riskColor};padding:12px 16px;font-style:italic;font-size:13px}
  @media print{body{margin:20px}}
</style></head><body>
<h1>SENTINEL AI — EXECUTIVE BRIEFING</h1>
<div class="meta">Generated: ${new Date(b.generated_at).toLocaleString()} &nbsp;|&nbsp; Mode: ${b.mode ?? "heuristic"}</div>
<span class="risk-badge">RISK LEVEL: ${b.overall_risk}</span>
<h2>Situation Summary</h2><p>${b.summary}</p>
<h2>Operational Narrative</h2><div class="narrative">${b.ai_narrative}</div>
<h2>Immediate Actions</h2><ul>${b.immediate_actions.map((a) => `<li>${a}</li>`).join("")}</ul>
<h2>Key Threats</h2><ul>${b.key_threats.map((t) => `<li>${t}</li>`).join("")}</ul>
<h2>High-Risk Districts</h2><p>${b.high_risk_districts.join(" · ") || "None identified"}</p>
<h2>Resource Gaps</h2><p>${b.resource_gaps.map((g) => g.replace(/_/g, " ")).join(", ") || "None"}</p>
<h2>Recommended Pre-Positioning</h2><ul>${b.recommended_preposition.map((r) => `<li>${r}</li>`).join("")}</ul>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── SVG Trend Chart ──────────────────────────────────────────────────────────

function TrendChart({ data, period }: { data: TrendPoint[]; period: string }) {
  if (!data.length) return null;
  const W = 800, H = 200, padL = 36, padR = 16, padT = 16, padB = 36;
  const iW = W - padL - padR;
  const iH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.count), 1);

  const xAt = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * iW;
  const yAt = (v: number) => padT + iH - (v / max) * iH;

  const linePath = (key: keyof TrendPoint) =>
    data.map((d, i) =>
      `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(d[key] as number).toFixed(1)}`
    ).join(" ");

  const tickStep = period === "daily" ? 7 : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Incident trend chart">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line key={p} x1={padL} y1={padT + iH * (1 - p)} x2={padL + iW} y2={padT + iH * (1 - p)}
          stroke="#334155" strokeWidth="1" />
      ))}
      {/* Area fill */}
      <path
        d={`${linePath("count")} L ${xAt(data.length - 1).toFixed(1)} ${padT + iH} L ${xAt(0).toFixed(1)} ${padT + iH} Z`}
        fill="#3b82f6" opacity="0.07"
      />
      {/* Total line */}
      <path d={linePath("count")} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
      {/* Critical line */}
      <path d={linePath("critical")} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round" />
      {/* High line */}
      <path d={linePath("high")} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round" />
      {/* X-axis ticks */}
      {data.map((d, i) =>
        i % tickStep === 0 ? (
          <text key={i} x={xAt(i)} y={H - 6} textAnchor="middle" fill="#64748b" fontSize="10">
            {d.date.slice(5)}
          </text>
        ) : null
      )}
      {/* Y-axis labels */}
      {[0, Math.round(max / 2), max].map((v) => (
        <text key={v} x={padL - 5} y={yAt(v) + 4} textAnchor="end" fill="#64748b" fontSize="10">
          {v}
        </text>
      ))}
      {/* Legend */}
      <circle cx={padL + 10} cy={padT - 2} r="3" fill="#3b82f6" />
      <text x={padL + 16} y={padT + 2} fill="#94a3b8" fontSize="9">Total</text>
      <circle cx={padL + 55} cy={padT - 2} r="3" fill="#ef4444" />
      <text x={padL + 61} y={padT + 2} fill="#94a3b8" fontSize="9">Critical</text>
      <circle cx={padL + 105} cy={padT - 2} r="3" fill="#f97316" />
      <text x={padL + 111} y={padT + 2} fill="#94a3b8" fontSize="9">High</text>
    </svg>
  );
}

// ── Risk Timeline Bar Chart ──────────────────────────────────────────────────

function RiskTimelineChart({ data }: { data: RiskTimelinePoint[] }) {
  const max = Math.max(...data.map((d) => d.risk_score), 1);
  return (
    <div className="flex items-end gap-1 h-28 pt-2">
      {data.map((d) => {
        const pct = Math.max((d.risk_score / max) * 100, 4);
        const color = d.critical_count > 0 ? "#ef4444"
          : d.risk_score > max * 0.5 ? "#f97316"
          : "#3b82f6";
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-t cursor-pointer"
              style={{ height: `${pct}%`, background: color }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block
              bg-background border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-10 shadow-lg">
              <p className="font-semibold">{d.date}</p>
              <p>{d.incident_count} incidents · score {d.risk_score}</p>
            </div>
            <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Resource Forecast Card ────────────────────────────────────────────────────

function ResourceForecastCard({ item }: { item: ResourceForecast }) {
  const avail = item.current_available;
  const demand = item.predicted_demand_24h;
  const pct = avail + demand > 0 ? Math.round((demand / (avail + demand)) * 100) : 0;
  const barColor = item.shortage_risk === "high" ? "bg-red-500"
    : item.shortage_risk === "medium" ? "bg-yellow-500"
    : "bg-green-500";

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{RESOURCE_EMOJI[item.resource_type] ?? "📦"}</span>
          <span className="text-sm font-medium capitalize">
            {item.resource_type.replace(/_/g, " ")}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RISK_BADGE[item.shortage_risk]}`}>
          {item.shortage_risk.toUpperCase()}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-xs font-bold text-green-400">{avail}</p>
          <p className="text-[10px] text-muted-foreground">Available</p>
        </div>
        <div>
          <p className="text-xs font-bold text-yellow-400">{item.predicted_demand_24h}</p>
          <p className="text-[10px] text-muted-foreground">24h demand</p>
        </div>
        <div>
          <p className="text-xs font-bold text-blue-400">{item.predicted_demand_72h}</p>
          <p className="text-[10px] text-muted-foreground">72h demand</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Period = "daily" | "weekly" | "monthly";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [hotspots, setHotspots] = useState<HotspotCluster[]>([]);
  const [resourceFc, setResourceFc] = useState<ResourceForecast[]>([]);
  const [shelterFc, setShelterFc] = useState<ShelterForecast[]>([]);
  const [responseTime, setResponseTime] = useState<ResponseTimeStats | null>(null);
  const [riskTimeline, setRiskTimeline] = useState<RiskTimelinePoint[]>([]);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    const [br, tr, hs, rf, sf, rt, tl] = await Promise.all([
      fetchExecutiveBriefing(),
      fetchIncidentTrends(period),
      fetchHotspots(),
      fetchResourceForecast(),
      fetchShelterForecast(),
      fetchResponseTime(),
      fetchRiskTimeline(7),
    ]);
    setBriefing(br);
    setTrends(tr);
    setHotspots(hs);
    setResourceFc(rf);
    setShelterFc(sf);
    setResponseTime(rt);
    setRiskTimeline(tl);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    fetchIncidentTrends(p).then(setTrends);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading analytics…</span>
      </div>
    );
  }

  const riskColor = briefing ? RISK_COLORS[briefing.overall_risk] : "#f97316";
  const riskBg = briefing ? RISK_BG[briefing.overall_risk] : RISK_BG.HIGH;
  const highShortages = resourceFc.filter((r) => r.shortage_risk === "high");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
            <BarChart2 className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Operations Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Predictive analytics & decision support ·{" "}
              {briefing && new Date(briefing.generated_at).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {/* Export dropdown */}
          <div
            className="relative"
            onKeyDown={(e) => e.key === "Escape" && setExportOpen(false)}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen((o) => !o)}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-20 w-52 rounded-xl border border-border bg-card shadow-xl py-1">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                    onClick={() => {
                      downloadCSV(trends as unknown as Record<string, unknown>[], "sentinel-trends.csv");
                      setExportOpen(false);
                    }}
                  >
                    <Table2 className="h-3.5 w-3.5" /> Trend Data (CSV)
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                    onClick={() => {
                      downloadCSV(resourceFc as unknown as Record<string, unknown>[], "sentinel-resource-forecast.csv");
                      setExportOpen(false);
                    }}
                  >
                    <Package className="h-3.5 w-3.5" /> Resource Forecast (CSV)
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary border-t border-border"
                    onClick={() => {
                      if (briefing) printExecutiveBrief(briefing);
                      setExportOpen(false);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" /> Executive Brief (PDF)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Executive Briefing */}
      {briefing && (
        <div className={`rounded-xl border p-5 space-y-4 ${riskBg}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" style={{ color: riskColor }} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">Executive Briefing</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded border"
                    style={{ color: riskColor, borderColor: riskColor + "44", background: riskColor + "18" }}
                  >
                    {briefing.overall_risk} RISK
                  </span>
                  {briefing.mode === "ai" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      AI Generated
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{briefing.summary}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {briefing.high_risk_districts.slice(0, 3).map((d) => (
                <span key={d} className="flex items-center gap-1 text-xs rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />{d}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Immediate Actions
              </p>
              <ul className="space-y-1.5">
                {briefing.immediate_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[9px] font-bold">
                      {i + 1}
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Key Threats
              </p>
              <ul className="space-y-1.5">
                {briefing.key_threats.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-red-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Pre-Positioning
              </p>
              <ul className="space-y-1.5">
                {briefing.recommended_preposition.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3 shrink-0 mt-0.5 text-blue-400" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Narrative */}
          <div className="rounded-lg bg-background/40 border border-border/50 p-3">
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              {briefing.ai_narrative}
            </p>
          </div>
        </div>
      )}

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Incidents", value: (responseTime?.total_active ?? 0) + (responseTime?.total_resolved ?? 0) > 0 ? String(responseTime?.total_active ?? "—") : "—", icon: AlertTriangle, color: "text-red-400" },
          { label: "Resolved", value: `${responseTime?.resolution_rate_pct ?? 0}%`, icon: TrendingUp, color: "text-green-400" },
          { label: "Affected People", value: briefing ? "2,883+" : "—", icon: Users, color: "text-blue-400" },
          { label: "High Shortages", value: String(highShortages.length), icon: Package, color: "text-orange-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color} shrink-0`} />
                <div>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart + Risk timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Incident Trends
              </CardTitle>
              <div className="flex gap-1">
                {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors capitalize ${
                      period === p
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                        : "text-muted-foreground border border-transparent hover:border-border"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart data={trends} period={period} />
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground justify-end">
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-blue-400 inline-block" />Total</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-red-400 inline-block" style={{ background: "repeating-linear-gradient(90deg,#ef4444 0,#ef4444 4px,transparent 4px,transparent 7px)" }} />Critical</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-orange-400 inline-block" style={{ background: "repeating-linear-gradient(90deg,#f97316 0,#f97316 4px,transparent 4px,transparent 7px)" }} />High</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-purple-400" />
              7-Day Risk Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskTimelineChart data={riskTimeline} />
            <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500 inline-block" />Critical</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-orange-500 inline-block" />High</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500 inline-block" />Normal</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Forecast */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-orange-400" />
            Resource Demand Forecast
            {highShortages.length > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                {highShortages.length} shortage{highShortages.length > 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {resourceFc.map((item) => (
              <ResourceForecastCard key={item.resource_type} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shelter forecast + Response time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-green-400" />
              Shelter Occupancy Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Shelter</th>
                    <th className="text-center pb-2 font-medium">Now</th>
                    <th className="text-center pb-2 font-medium">24h Pred.</th>
                    <th className="text-left pb-2 font-medium w-24">Fill rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shelterFc.map((s) => {
                    const pred = s.predicted_pct_24h;
                    const barColor = pred >= 90 ? "bg-red-500" : pred >= 70 ? "bg-orange-500" : "bg-green-500";
                    return (
                      <tr key={s.shelter_id}>
                        <td className="py-2 pr-3 font-medium text-foreground truncate max-w-[160px]">{s.name}</td>
                        <td className="py-2 text-center text-muted-foreground">{s.current_pct}%</td>
                        <td className="py-2 text-center font-semibold"
                          style={{ color: pred >= 90 ? "#ef4444" : pred >= 70 ? "#f97316" : "#22c55e" }}>
                          {pred}%
                        </td>
                        <td className="py-2">
                          <div className="h-1.5 w-20 rounded-full bg-secondary">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pred}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-400" />
              Response Time Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {responseTime && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg bg-secondary p-2.5 text-center">
                    <p className="text-lg font-bold text-green-400">{responseTime.total_resolved}</p>
                    <p className="text-[10px] text-muted-foreground">Resolved</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-2.5 text-center">
                    <p className="text-lg font-bold text-orange-400">{responseTime.total_active}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-2.5 text-center">
                    <p className="text-lg font-bold text-blue-400">{responseTime.resolution_rate_pct}%</p>
                    <p className="text-[10px] text-muted-foreground">Resolved rate</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Severity</th>
                        <th className="text-center pb-2 font-medium">Count</th>
                        <th className="text-center pb-2 font-medium">Avg</th>
                        <th className="text-center pb-2 font-medium">P50</th>
                        <th className="text-center pb-2 font-medium">P90</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(["critical", "high", "medium", "low"] as const).map((sev) => {
                        const s = responseTime.by_severity[sev];
                        return (
                          <tr key={sev}>
                            <td className="py-1.5 capitalize font-medium" style={{ color: SEV_COLORS[sev] }}>
                              {sev}
                            </td>
                            <td className="py-1.5 text-center text-muted-foreground">{s?.count ?? 0}</td>
                            <td className="py-1.5 text-center">{s?.avg_hours ?? "—"}h</td>
                            <td className="py-1.5 text-center">{s?.p50_hours ?? "—"}h</td>
                            <td className="py-1.5 text-center text-muted-foreground">{s?.p90_hours ?? "—"}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hotspot Clusters */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Disaster Hotspot Clusters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hotspots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active clusters detected.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {hotspots.map((h, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold truncate">{h.district}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {h.dominant_type.replace(/_/g, " ")} cluster
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                      style={{
                        color: SEV_COLORS[h.severity_level] ?? "#eab308",
                        borderColor: (SEV_COLORS[h.severity_level] ?? "#eab308") + "44",
                        background: (SEV_COLORS[h.severity_level] ?? "#eab308") + "15",
                      }}
                    >
                      {h.severity_level.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{h.incident_count} incidents
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />{h.total_affected.toLocaleString()} affected
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Intensity</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div
                          key={j}
                          className="h-2 w-4 rounded-sm"
                          style={{
                            background: j < Math.round(h.intensity)
                              ? SEV_COLORS[h.severity_level] ?? "#eab308"
                              : "#1e293b",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {h.lat.toFixed(4)}, {h.lng.toFixed(4)} · r={h.radius_km}km
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
