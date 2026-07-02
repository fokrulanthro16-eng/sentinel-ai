"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle, Activity, Home, Users, RefreshCw,
  Droplets, TrendingUp, ShieldAlert, Clock, CheckCircle2,
  ShieldCheck, Loader2,
} from "lucide-react";
import StatsCard from "@/components/dashboard/StatsCard";
import AlertsFeed from "@/components/dashboard/AlertsFeed";
import RiskSummary from "@/components/dashboard/RiskSummary";
import IncidentTable from "@/components/dashboard/IncidentTable";
import ShelterPanel from "@/components/shared/ShelterPanel";
import ExternalIntelligencePanel from "@/components/dashboard/ExternalIntelligencePanel";
import { fetchIncidents, fetchAlerts, fetchRiskSummary, fetchShelters, fetchResourceStats } from "@/lib/api";
import { Incident, Alert, RiskSummary as RiskSummaryType, Shelter, ResourceStats } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtime } from "@/contexts/RealtimeContext";
import ConnectionStatus from "@/components/shared/ConnectionStatus";

const RiskMap = dynamic(() => import("@/components/map/RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-secondary text-muted-foreground text-sm">
      Loading map…
    </div>
  ),
});

const RISK_CARDS = [
  { key: "critical" as const, label: "Critical", emoji: "🔴", text: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10", dot: "bg-red-500" },
  { key: "high" as const, label: "High", emoji: "🟠", text: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10", dot: "bg-orange-500" },
  { key: "medium" as const, label: "Medium", emoji: "🟡", text: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", dot: "bg-yellow-500" },
  { key: "low" as const, label: "Low", emoji: "🟢", text: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10", dot: "bg-green-500" },
];

const WORKFLOW_CARDS = [
  { key: "pending",     label: "Pending Review", icon: Clock,        color: "text-yellow-400",        bg: "bg-yellow-500/10 border-yellow-500/20" },
  { key: "verified",    label: "Verified",        icon: ShieldCheck,  color: "text-blue-400",          bg: "bg-blue-500/10 border-blue-500/20"   },
  { key: "in_progress", label: "In Progress",     icon: Activity,     color: "text-orange-400",        bg: "bg-orange-500/10 border-orange-500/20"},
  { key: "resolved",    label: "Resolved",        icon: CheckCircle2, color: "text-green-400",         bg: "bg-green-500/10 border-green-500/20" },
];

function ResourceNeedsCard({ shelters }: { shelters: Shelter[] }) {
  const [stats, setStats] = useState<ResourceStats | null>(null);

  useEffect(() => {
    fetchResourceStats().then(setStats).catch(() => {});
  }, []);

  const totalCapacity = shelters.reduce((s, sh) => s + sh.capacity, 0);
  const totalOccupied = shelters.reduce((s, sh) => s + sh.current_occupancy, 0);
  const availableSpots = totalCapacity - totalOccupied;
  const pct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  return (
    <Card className="border-blue-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Droplets className="h-4 w-4 text-blue-400" />
          Resource Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Shelter Capacity</span>
            <span className="font-medium">{availableSpots.toLocaleString()} spots free</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {totalOccupied.toLocaleString()} / {totalCapacity.toLocaleString()} occupied ({pct}%)
          </p>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-secondary p-2.5 text-center">
                <p className="text-lg font-bold text-green-400">{stats.available_count}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="rounded-lg bg-secondary p-2.5 text-center">
                <p className="text-lg font-bold text-blue-400">{stats.deployed_count}</p>
                <p className="text-xs text-muted-foreground">Deployed</p>
              </div>
              <div className="rounded-lg bg-secondary p-2.5 text-center">
                <p className={`text-lg font-bold ${stats.pending_requests > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                  {stats.pending_requests}
                </p>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </div>
              <div className="rounded-lg bg-secondary p-2.5 text-center">
                <p className={`text-lg font-bold ${stats.critical_requests > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {stats.critical_requests}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
            {stats.shortages.length > 0 && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                <p className="text-xs font-semibold text-red-400 mb-1.5">Shortages</p>
                <ul className="space-y-1">
                  {stats.shortages.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                      {s.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<RiskSummaryType | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { subscribe } = useRealtime();

  const load = async () => {
    setLoading(true);
    const [inc, alrt, sum, shlt] = await Promise.all([
      fetchIncidents(),
      fetchAlerts(),
      fetchRiskSummary(),
      fetchShelters(),
    ]);
    setIncidents(inc);
    setAlerts(alrt);
    setSummary(sum);
    setShelters(shlt);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Subscribe to realtime incident events
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "incident.created") {
        const inc = msg.incident as Incident;
        setIncidents((prev) =>
          prev.find((i) => i.id === inc.id) ? prev : [inc, ...prev]
        );
        setLastRefresh(new Date());
      } else if (msg.type === "incident.updated") {
        const inc = msg.incident as Incident;
        setIncidents((prev) =>
          prev.map((i) => (i.id === inc.id ? { ...i, ...inc } : i))
        );
        setLastRefresh(new Date());
      }
    });
  }, [subscribe]);

  // Derived analytics from live incidents state
  const criticalCount = incidents.filter((i) => i.severity === "critical").length;
  const highCount     = incidents.filter((i) => i.severity === "high").length;
  const mediumCount   = incidents.filter((i) => i.severity === "medium").length;
  const lowCount      = incidents.filter((i) => i.severity === "low").length;

  const activeCount   = incidents.filter((i) => i.status !== "resolved").length;
  const totalAffected = incidents.reduce((s, i) => s + (i.affected_count || 0), 0);
  const openShelters  = shelters.filter((s) => s.status !== "closed" && s.status !== "full").length;

  const riskCounts: Record<string, number> = { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount };

  const workflowCounts = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/30">
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Authority Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()} · {incidents.length} incidents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-border bg-secondary/40 px-3 py-1.5">
            <ConnectionStatus />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Active Incidents" value={activeCount} subtitle={`${criticalCount} critical`} icon={Activity} iconColor="text-red-400" pulse={criticalCount > 0} loading={loading} />
        <StatsCard title="Active Alerts" value={alerts.length} subtitle="Public notifications" icon={AlertTriangle} iconColor="text-orange-400" loading={loading} />
        <StatsCard title="Open Shelters" value={openShelters} subtitle={`of ${shelters.length} total`} icon={Home} iconColor="text-blue-400" loading={loading} />
        <StatsCard title="People Affected" value={totalAffected.toLocaleString()} subtitle="Across all incidents" icon={Users} iconColor="text-purple-400" loading={loading} />
      </div>

      {/* Workflow status breakdown */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Incident Workflow</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {WORKFLOW_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
            <div key={key} className={`rounded-xl border p-4 flex items-center gap-3 ${bg}`}>
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
              <div>
                <p className={`text-2xl font-bold ${color}`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin inline" /> : (workflowCounts[key] ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk level breakdown */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Risk Level Breakdown</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {RISK_CARDS.map(({ key, label, emoji, text, border, bg, dot }) => (
            <div key={key} className={`rounded-xl border p-4 flex items-center gap-3 ${border} ${bg}`}>
              <div className="text-xl">{emoji}</div>
              <div>
                <p className={`text-2xl font-bold ${text}`}>{riskCounts[key]}</p>
                <p className="text-xs text-muted-foreground">{label} Risk</p>
              </div>
              {riskCounts[key] > 0 && key === "critical" && (
                <span className="ml-auto relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-75`} />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* External Intelligence Panel */}
      <ExternalIntelligencePanel />

      {/* Map + right sidebar */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden" style={{ height: 460 }}>
          <RiskMap incidents={incidents} shelters={shelters} height="100%" />
        </div>
        <div className="space-y-5">
          <AlertsFeed alerts={alerts} />
          <ResourceNeedsCard shelters={shelters} />
        </div>
      </div>

      {/* AI Summary + Shelter Panel */}
      <div className="grid lg:grid-cols-2 gap-5">
        <RiskSummary
          summary={summary ?? {
            overall_risk_level: "HIGH",
            executive_summary: loading ? "Loading AI analysis…" : "AI analysis unavailable — using mock data.",
            key_threats: [],
            population_at_risk: totalAffected,
            incident_hotspots: [],
            forecast: "",
            immediate_priorities: [],
            generated_at: new Date().toISOString(),
          }}
          loading={loading}
        />

        <ShelterPanel shelters={shelters} />
      </div>

      {/* Incident Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Incidents</h2>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{incidents.length} total</span>
          </div>
        </div>
        <IncidentTable incidents={incidents} />
      </div>
    </div>
  );
}
