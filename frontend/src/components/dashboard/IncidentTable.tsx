"use client";
import { useState, useMemo } from "react";
import { Incident, Severity } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { INCIDENT_ICONS, formatRelativeTime, SEVERITY_COLORS } from "@/lib/utils";
import { downloadCSV, incidentsToRows, downloadIncidentsPDF } from "@/lib/export";
import TrustScoreBadge from "@/components/shared/TrustScoreBadge";
import {
  CheckCircle2, Activity, Eye, ChevronUp, ChevronDown,
  Search, Clock, ChevronLeft, ChevronRight,
  FileDown, FileText, Printer, Loader2,
} from "lucide-react";

const STATUS_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending:    { icon: <Clock className="h-3.5 w-3.5 text-yellow-400" />,     color: "text-yellow-400",  label: "Pending"    },
  active:     { icon: <Activity className="h-3.5 w-3.5 text-red-400" />,      color: "text-red-400",     label: "Active"     },
  monitoring: { icon: <Eye className="h-3.5 w-3.5 text-blue-400" />,          color: "text-blue-400",    label: "Monitoring" },
  verified:   { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />, color: "text-green-400",  label: "Verified"   },
  in_progress:{ icon: <Activity className="h-3.5 w-3.5 text-orange-400" />,   color: "text-orange-400",  label: "In Progress"},
  resolved:   { icon: <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />, color: "text-muted-foreground", label: "Resolved" },
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_FILTERS: Array<{ key: Severity | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

type SortKey = "severity" | "time" | "affected";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

interface IncidentTableProps {
  incidents: Incident[];
}

export default function IncidentTable({ incidents }: IncidentTableProps) {
  const [search, setSearch] = useState("");
  const [filterSev, setFilterSev] = useState<Severity | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleCSV = () => {
    downloadCSV(`sentinel-incidents-${Date.now()}.csv`, incidentsToRows(filtered));
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    await downloadIncidentsPDF(filtered).catch(() => {});
    setPdfLoading(false);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let items = incidents;
    if (filterSev !== "all") items = items.filter((i) => i.severity === filterSev);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.location_name.toLowerCase().includes(q) ||
          (i.ai_category ?? "").toLowerCase().includes(q)
      );
    }
    const rev = sortDir === "desc";
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "severity") cmp = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
      else if (sortKey === "time") cmp = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      else if (sortKey === "affected") cmp = (b.affected_count ?? 0) - (a.affected_count ?? 0);
      return rev ? -cmp : cmp;
    });
  }, [incidents, filterSev, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 opacity-20 ml-1 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1 inline text-primary" />
      : <ChevronDown className="h-3 w-3 ml-1 inline text-primary" />;
  }

  return (
    <div className="space-y-3">
      {/* Export toolbar */}
      <div className="flex items-center justify-end gap-2 print:hidden">
        <button
          onClick={handleCSV}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <FileDown className="h-3.5 w-3.5" />
          CSV
        </button>
        <button
          onClick={handlePDF}
          disabled={pdfLoading}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
        >
          {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          PDF
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>

      {/* Search + severity filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search title, location, AI category…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {SEVERITY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilterSev(key); setPage(1); }}
              className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
              style={
                key !== "all" && filterSev === key
                  ? { background: `${SEVERITY_COLORS[key as Severity]}22`, borderColor: SEVERITY_COLORS[key as Severity], color: SEVERITY_COLORS[key as Severity] }
                  : { background: "transparent", borderColor: "hsl(var(--border))", color: filterSev === key ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }
              }
            >
              {key === "all" ? `All (${incidents.length})` : label}
            </button>
          ))}
        </div>
      </div>

      {/* Result info */}
      {(search || filterSev !== "all") && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {incidents.length} incidents
        </p>
      )}

      {/* Table */}
      {pageItems.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-muted-foreground text-sm">
          {search || filterSev !== "all" ? "No incidents match your filters." : "No incidents recorded yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Incident</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Location</th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("severity")}
                >
                  Severity <SortIcon col="severity" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Trust</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">AI</th>
                <th className="px-4 py-3 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.map((inc) => {
                const sm = STATUS_META[inc.status] ?? STATUS_META.pending;
                return (
                  <tr key={inc.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-lg">{INCIDENT_ICONS[inc.type] ?? "📍"}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground leading-tight">{inc.title}</p>
                        {inc.ai_category && <p className="text-xs text-blue-400 mt-0.5">🤖 {inc.ai_category}</p>}
                        {inc.verified && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate hidden md:table-cell">{inc.location_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inc.severity as Severity}>{inc.severity}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <TrustScoreBadge
                        trust_score={inc.trust_score}
                        confidence_level={inc.confidence_level}
                        size="sm"
                        showLabel={false}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs ${sm.color}`}>
                        {sm.icon} {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {inc.affected_count != null ? inc.affected_count.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                      {formatRelativeTime(inc.timestamp)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {inc.ai_confidence != null ? (
                        <div className="flex items-center gap-2 min-w-[70px]">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round(inc.ai_confidence * 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(inc.ai_confidence * 100)}%</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-3 print:hidden">
                      <a
                        href={`/incidents/${inc.id}/print`}
                        target="_blank"
                        rel="noopener"
                        title="Print / Export"
                        className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page <span className="font-semibold text-foreground">{safePage}</span> of {totalPages}
            {" "}· {filtered.length} results
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
