"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database, Users, Zap, Globe, BadgeCheck,
  Search, Filter, RefreshCw, FileDown, FileText,
  Clock, CheckCircle2, Activity, AlertTriangle,
  ChevronLeft, ChevronRight, X, Loader2,
  ShieldCheck, StickyNote, ChevronUp, ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchIncidents } from "@/lib/api";
import { Incident, IncidentType, Severity, IncidentStatus } from "@/types";
import { INCIDENT_ICONS, formatRelativeTime, cn } from "@/lib/utils";
import { downloadCSV, incidentsToRows, downloadIncidentsPDF } from "@/lib/export";
import { useRealtime } from "@/contexts/RealtimeContext";

// ── Section definitions ────────────────────────────────────────────────────

type SectionKey = "all" | "citizen" | "responder" | "external" | "verified";

interface Section {
  key: SectionKey;
  label: string;
  icon: React.ElementType;
  color: string;
  ring: string;
  filter: (i: Incident) => boolean;
  description: string;
}

const SECTIONS: Section[] = [
  {
    key: "all",
    label: "All Reports",
    icon: Database,
    color: "text-blue-400",
    ring: "border-blue-500/40 bg-blue-500/10",
    filter: () => true,
    description: "All incident reports across every channel",
  },
  {
    key: "citizen",
    label: "Citizen Reports",
    icon: Users,
    color: "text-green-400",
    ring: "border-green-500/40 bg-green-500/10",
    filter: (i) => !i.verified && (i.status === "pending" || i.status === "active" || i.status === "monitoring"),
    description: "Unverified reports submitted by the public",
  },
  {
    key: "responder",
    label: "Responder Updates",
    icon: Zap,
    color: "text-orange-400",
    ring: "border-orange-500/40 bg-orange-500/10",
    filter: (i) => !!(i.reporter_id) || i.status === "in_progress" || i.status === "verified",
    description: "Updates from verified responders in the field",
  },
  {
    key: "external",
    label: "External Sources",
    icon: Globe,
    color: "text-purple-400",
    ring: "border-purple-500/40 bg-purple-500/10",
    filter: (i) => !!(i.ai_category),
    description: "AI-classified reports from integrated data feeds",
  },
  {
    key: "verified",
    label: "Verified Incidents",
    icon: BadgeCheck,
    color: "text-sky-400",
    ring: "border-sky-500/40 bg-sky-500/10",
    filter: (i) => i.verified,
    description: "Incidents confirmed by administration",
  },
];

// ── Filter helpers ─────────────────────────────────────────────────────────

const TYPES: IncidentType[] = ["flood","fire","medical","infrastructure","civil_unrest","contamination","power_outage","landslide","other"];
const SEVERITIES: Severity[] = ["critical","high","medium","low"];
const STATUSES: IncidentStatus[] = ["pending","active","monitoring","verified","in_progress","resolved"];

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending:    { color: "text-yellow-400", label: "Pending"     },
  active:     { color: "text-red-400",    label: "Active"      },
  monitoring: { color: "text-blue-400",   label: "Monitoring"  },
  verified:   { color: "text-green-400",  label: "Verified"    },
  in_progress:{ color: "text-orange-400", label: "In Progress" },
  resolved:   { color: "text-muted-foreground", label: "Resolved" },
};

function sourceLabel(i: Incident): string {
  if (i.reporter_id)      return "Responder";
  if (i.ai_category)      return "AI / External";
  if (i.reporter_name)    return "Citizen";
  return "Anonymous";
}

const PAGE_SIZE = 15;

// ── Component ─────────────────────────────────────────────────────────────

export default function DataCollectionPage() {
  const [all, setAll]             = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Filters
  const [section, setSection]     = useState<SectionKey>("all");
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [district, setDistrict]   = useState("");
  const [page, setPage]           = useState(1);

  // Sort
  const [sortCol, setSortCol]     = useState<"time" | "severity" | "affected">("time");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  const { subscribe } = useRealtime();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchIncidents({ limit: 500 });
    setAll(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live updates
  useEffect(() => subscribe((msg) => {
    if (msg.type === "incident.created") {
      const inc = msg.incident as Incident;
      setAll((prev) => prev.find((i) => i.id === inc.id) ? prev : [inc, ...prev]);
    } else if (msg.type === "incident.updated") {
      const inc = msg.incident as Incident;
      setAll((prev) => prev.map((i) => i.id === inc.id ? { ...i, ...inc } : i));
    }
  }), [subscribe]);

  // Extract unique districts from location_name
  const districts = useMemo(() => {
    const seen = new Set<string>();
    all.forEach((i) => {
      const d = i.location_name.split(",")[0].trim();
      if (d) seen.add(d);
    });
    return Array.from(seen).sort();
  }, [all]);

  // Stats (computed from all incidents, ignoring active tab/filters)
  const stats = useMemo(() => ({
    total:     all.length,
    pending:   all.filter((i) => i.status === "pending").length,
    verified:  all.filter((i) => i.verified).length,
    active:    all.filter((i) => (i.status === "active" || i.status === "in_progress") && (i.severity === "critical" || i.severity === "high")).length,
  }), [all]);

  // Section counts (tab badges, no user filters applied)
  const sectionCounts = useMemo(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, all.filter(s.filter).length])),
  [all]);

  // Full filtered + sorted result
  const SEV_ORDER: Record<string, number> = { critical:0, high:1, medium:2, low:3 };

  const filtered = useMemo(() => {
    const sec = SECTIONS.find((s) => s.key === section)!;
    let items = all.filter(sec.filter);

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.location_name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.ai_category ?? "").toLowerCase().includes(q) ||
        (i.reporter_name ?? "").toLowerCase().includes(q)
      );
    }
    if (catFilter)    items = items.filter((i) => i.type === catFilter);
    if (sevFilter)    items = items.filter((i) => i.severity === sevFilter);
    if (statusFilter) items = items.filter((i) => i.status === statusFilter);
    if (district)     items = items.filter((i) => i.location_name.toLowerCase().includes(district.toLowerCase()));
    if (dateFrom)     items = items.filter((i) => new Date(i.timestamp) >= new Date(dateFrom));
    if (dateTo)       items = items.filter((i) => new Date(i.timestamp) <= new Date(dateTo + "T23:59:59"));

    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "time")     cmp = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortCol === "severity") cmp = (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4);
      if (sortCol === "affected") cmp = (b.affected_count ?? 0) - (a.affected_count ?? 0);
      return sortDir === "asc" ? -cmp : cmp;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, section, search, catFilter, sevFilter, statusFilter, district, dateFrom, dateTo, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = !!(search || catFilter || sevFilter || statusFilter || district || dateFrom || dateTo);

  const clearFilters = () => {
    setSearch(""); setCatFilter(""); setSevFilter(""); setStatusFilter("");
    setDistrict(""); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(1);
  };

  const handleCSV = () => {
    downloadCSV(`data-collection-${section}-${Date.now()}.csv`, incidentsToRows(filtered));
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    const sec = SECTIONS.find((s) => s.key === section)!;
    await downloadIncidentsPDF(filtered, `Sentinel AI — ${sec.label}`).catch(() => {});
    setPdfLoading(false);
  };

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <ChevronUp className="h-3 w-3 opacity-20 ml-0.5 inline" />;
    return sortDir === "asc"
      ? <ChevronUp   className="h-3 w-3 ml-0.5 inline text-primary" />
      : <ChevronDown className="h-3 w-3 ml-0.5 inline text-primary" />;
  }

  const activeSection = SECTIONS.find((s) => s.key === section)!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-500/30">
            <Database className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Data Collection Center</h1>
            <p className="text-sm text-muted-foreground">Unified incident intelligence from all reporting channels</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="print:hidden">
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSV} disabled={filtered.length === 0} className="print:hidden">
            <FileDown className="mr-2 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF} disabled={filtered.length === 0 || pdfLoading} className="print:hidden">
            {pdfLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Reports",       value: stats.total,    icon: Database,     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20"   },
          { label: "Pending Verification",value: stats.pending,  icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20"},
          { label: "Verified Reports",    value: stats.verified, icon: ShieldCheck,  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
          { label: "Active Emergencies",  value: stats.active,   icon: AlertTriangle,color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",     pulse: stats.active > 0 },
        ].map(({ label, value, icon: Icon, color, bg, pulse }) => (
          <Card key={label} className={cn("border", bg)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="relative shrink-0">
                <Icon className={cn("h-5 w-5", color)} />
                {pulse && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </div>
              <div>
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : <p className={cn("text-2xl font-bold", color)}>{value.toLocaleString()}</p>
                }
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Section Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => { setSection(s.key); setPage(1); }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                active ? `${s.ring} ${s.color}` : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
                active ? "bg-white/10" : "bg-secondary"
              )}>
                {loading ? "…" : sectionCounts[s.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active section description */}
      <p className="text-xs text-muted-foreground -mt-2">{activeSection.description}</p>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline font-normal normal-case tracking-normal">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>

        {/* Row 1: search + dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search title, location, AI category…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <select
            value={catFilter}
            onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{INCIDENT_ICONS[t] ?? "•"} {t.replace(/_/g, " ")}</option>
            ))}
          </select>

          <select
            value={sevFilter}
            onChange={(e) => { setSevFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Row 2: date + district */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <select
            value={district}
            onChange={(e) => { setDistrict(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Districts</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── Results summary ── */}
      {(hasFilters || section !== "all") && !loading && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {all.length} reports
          {hasFilters && <> · <button onClick={clearFilters} className="text-primary hover:underline">clear filters</button></>}
        </p>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading reports…</span>
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Database className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">No reports match your criteria</p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("severity")}
                  >
                    Severity <SortIcon col="severity" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Source</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground hidden sm:table-cell"
                    onClick={() => toggleSort("affected")}
                  >
                    Affected <SortIcon col="affected" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground hidden lg:table-cell"
                    onClick={() => toggleSort("time")}
                  >
                    Time <SortIcon col="time" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((inc) => {
                  const sm = STATUS_META[inc.status] ?? STATUS_META.pending;
                  return (
                    <tr key={inc.id} className="hover:bg-secondary/20 transition-colors">
                      {/* Type icon */}
                      <td className="px-4 py-3 text-lg text-center">{INCIDENT_ICONS[inc.type] ?? "📍"}</td>

                      {/* Title + AI */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-foreground leading-tight truncate">{inc.title}</p>
                        {inc.ai_category && (
                          <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
                            🤖 {inc.ai_category}
                            {inc.ai_confidence != null && (
                              <span className="text-muted-foreground">({Math.round(inc.ai_confidence * 100)}%)</span>
                            )}
                          </p>
                        )}
                        {inc.admin_notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <StickyNote className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[160px]">{inc.admin_notes}</span>
                          </p>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3">
                        <Badge variant={inc.severity as Severity}>{inc.severity}</Badge>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1.5 text-xs whitespace-nowrap", sm.color)}>
                          {inc.status === "verified" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : inc.status === "in_progress" ? (
                            <Activity className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                          )}
                          {sm.label}
                        </span>
                        {inc.verified && (
                          <span className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3 w-3 shrink-0" /> Verified
                          </span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[130px] truncate hidden md:table-cell">
                        {inc.location_name}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{sourceLabel(inc)}</span>
                          {inc.reporter_name && (
                            <span className="text-foreground font-medium">· {inc.reporter_name}</span>
                          )}
                        </span>
                      </td>

                      {/* Affected */}
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums hidden sm:table-cell">
                        {inc.affected_count != null ? inc.affected_count.toLocaleString() : "—"}
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                        {formatRelativeTime(inc.timestamp)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 print:hidden">
                        <a
                          href={`/incidents/${inc.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-border bg-secondary/40 px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          Report
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page <span className="font-semibold text-foreground">{safePage}</span> of {totalPages}
            {" "}· <span className="font-semibold text-foreground">{filtered.length}</span> results
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
