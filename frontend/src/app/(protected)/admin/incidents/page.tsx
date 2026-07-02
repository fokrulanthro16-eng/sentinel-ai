"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, Filter, RefreshCw,
  CheckCircle2, Clock, Activity, Eye, ShieldCheck,
  AlertCircle, Loader2, FileWarning, StickyNote, FileDown,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Incident, PaginatedIncidents } from "@/types";
import { fetchIncidentsAdmin, updateIncidentStatus, fetchIncidentAnalytics } from "@/lib/api";
import { formatRelativeTime, SEVERITY_COLORS, INCIDENT_ICONS } from "@/lib/utils";
import { downloadCSV, incidentsToRows } from "@/lib/export";
import TrustScoreBadge from "@/components/shared/TrustScoreBadge";
import AIRecommendationPanel from "@/components/admin/AIRecommendationPanel";

const STATUSES = [
  { value: "pending",     label: "Pending",     icon: Clock,        color: "text-yellow-400" },
  { value: "verified",    label: "Verified",    icon: ShieldCheck,  color: "text-blue-400" },
  { value: "in_progress", label: "In Progress", icon: Activity,     color: "text-orange-400" },
  { value: "resolved",    label: "Resolved",    icon: CheckCircle2, color: "text-green-400" },
  { value: "monitoring",  label: "Monitoring",  icon: Eye,          color: "text-blue-300" },
];

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const PER_PAGE = 20;

interface NotesModal {
  incidentId: string;
  title: string;
  notes: string;
  nextStatus: string;
}

export default function AdminIncidentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<PaginatedIncidents | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [modal, setModal] = useState<NotesModal | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/user-dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, anl] = await Promise.all([
      fetchIncidentsAdmin({
        page,
        per_page: PER_PAGE,
        severity: filterSeverity || undefined,
        status: filterStatus || undefined,
        search: debouncedSearch || undefined,
        sort_by: "timestamp",
        sort_dir: "desc",
      }),
      fetchIncidentAnalytics(),
    ]);
    setData(result);
    setAnalytics(anl.by_status ?? {});
    setLoading(false);
  }, [page, filterSeverity, filterStatus, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (inc: Incident, newStatus: string) => {
    if (newStatus === "verified" || newStatus === "resolved" || newStatus === "in_progress") {
      setModal({ incidentId: inc.id, title: inc.title, notes: inc.admin_notes ?? "", nextStatus: newStatus });
    } else {
      await applyStatus(inc.id, newStatus, undefined);
    }
  };

  const applyStatus = async (incidentId: string, newStatus: string, notes: string | undefined) => {
    setUpdatingId(incidentId);
    try {
      await updateIncidentStatus(incidentId, newStatus, notes);
      await load();
    } catch {
      // keep mock data visible
    } finally {
      setUpdatingId(null);
      setModal(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-400" />
            Incident Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review, verify and update incident status · Trust Engine active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => data && downloadCSV(`incidents-${Date.now()}.csv`, incidentsToRows(data.items))}
            disabled={!data || data.items.length === 0}
          >
            <FileDown className="mr-2 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Workflow overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUSES.map(({ value, label, icon: Icon, color }) => (
          <button
            key={value}
            onClick={() => { setFilterStatus(filterStatus === value ? "" : value); setPage(1); }}
            className={`rounded-xl border p-3 text-left transition-colors ${
              filterStatus === value
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-card hover:bg-secondary/50"
            }`}
          >
            <Icon className={`h-4 w-4 ${color} mb-1`} />
            <p className={`text-xl font-bold ${color}`}>{analytics[value] ?? 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search title, location, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              onClick={() => { setFilterSeverity(filterSeverity === sev ? "" : sev); setPage(1); }}
              className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
              style={
                filterSeverity === sev
                  ? { background: `${SEVERITY_COLORS[sev]}22`, borderColor: SEVERITY_COLORS[sev], color: SEVERITY_COLORS[sev] }
                  : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
              }
            >
              {sev}
            </button>
          ))}
          {(filterSeverity || filterStatus || debouncedSearch) && (
            <button
              onClick={() => { setFilterSeverity(""); setFilterStatus(""); setSearch(""); setPage(1); }}
              className="text-xs text-primary hover:underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading incidents…</span>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <AlertCircle className="h-10 w-10 opacity-30" />
              <p className="text-sm">No incidents match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Incident</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trust</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Reporter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    <th className="px-2 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((inc) => {
                    const sm = STATUSES.find((s) => s.value === inc.status) ?? STATUSES[0];
                    const Icon = sm.icon;
                    const isExpanded = expandedId === inc.id;
                    return (
                      <Fragment key={inc.id}>
                        <tr
                          className={`hover:bg-secondary/20 transition-colors ${isExpanded ? "bg-secondary/10" : ""}`}
                        >
                          <td className="px-4 py-3 max-w-xs">
                            <div className="flex items-start gap-2">
                              <span className="text-base shrink-0">{INCIDENT_ICONS[inc.type] ?? "📍"}</span>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground leading-tight truncate">{inc.title}</p>
                                {inc.ai_category && (
                                  <p className="text-xs text-blue-400 mt-0.5">🤖 {inc.ai_category}</p>
                                )}
                                {inc.admin_notes && (
                                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <StickyNote className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[180px]">{inc.admin_notes}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[140px] truncate">
                            {inc.location_name}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={inc.severity as any}>{inc.severity}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <TrustScoreBadge
                              trust_score={inc.trust_score}
                              confidence_level={inc.confidence_level}
                              size="sm"
                              showLabel={false}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1.5 text-xs ${sm.color}`}>
                              <Icon className="h-3.5 w-3.5" />
                              {sm.label}
                            </span>
                            {inc.verified && (
                              <span className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                            {inc.reporter_name ?? (inc.reporter_id ? "Registered user" : "Anonymous")}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                            {formatRelativeTime(inc.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            {updatingId === inc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {STATUSES.filter((s) => s.value !== inc.status).slice(0, 3).map(({ value, label }) => (
                                  <button
                                    key={value}
                                    onClick={() => handleStatusChange(inc, value)}
                                    className="rounded border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                  >
                                    → {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              onClick={() => toggleExpand(inc.id)}
                              title={isExpanded ? "Collapse AI panel" : "Expand AI analysis"}
                              className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                                isExpanded
                                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-secondary/5">
                            <td colSpan={9} className="px-6 py-5 border-b border-border">
                              <AIRecommendationPanel
                                incident={inc}
                                onVerify={() => handleStatusChange(inc, "verified")}
                                onReject={() => handleStatusChange(inc, "resolved")}
                                onRefreshIncident={load}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page <span className="font-semibold text-foreground">{data.page}</span> of {data.pages}
            {" "}· {data.total} total incidents
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages || loading}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Notes / Confirm modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-foreground">
                Mark as{" "}
                <span className="text-primary capitalize">{modal.nextStatus.replace("_", " ")}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{modal.title}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Admin Notes (optional)
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3}
                placeholder="Add notes about this status change…"
                value={modal.notes}
                onChange={(e) => setModal((m) => m ? { ...m, notes: e.target.value } : m)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => applyStatus(modal.incidentId, modal.nextStatus, modal.notes || undefined)}
                disabled={!!updatingId}
              >
                {updatingId ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
