"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package, Droplets, Apple, HeartPulse, Home, Truck, Users, ShieldCheck,
  RefreshCw, WifiOff, ChevronDown, ChevronUp, Send, AlertTriangle,
} from "lucide-react";
import {
  fetchResourceInventory, fetchResourceStats, fetchResourceRequests,
  submitResourceRequest,
} from "@/lib/api";
import { enqueueResourceRequest, flushRequestQueue } from "@/lib/offline-queue";
import { Resource, ResourceStats, ResourceRequest, ResourceType } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtime } from "@/contexts/RealtimeContext";

// ── helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<ResourceType, { label: string; icon: React.ElementType; color: string }> = {
  food:        { label: "Food",         icon: Apple,      color: "text-green-400" },
  water:       { label: "Water",        icon: Droplets,   color: "text-blue-400" },
  medical:     { label: "Medical",      icon: HeartPulse, color: "text-red-400" },
  shelter:     { label: "Shelter",      icon: Home,       color: "text-orange-400" },
  rescue_team: { label: "Rescue Team",  icon: ShieldCheck,color: "text-purple-400" },
  vehicle:     { label: "Vehicle",      icon: Truck,      color: "text-cyan-400" },
  volunteer:   { label: "Volunteer",    icon: Users,      color: "text-yellow-400" },
};

const STATUS_STYLE: Record<string, string> = {
  available:   "bg-green-500/15 text-green-400 border-green-500/30",
  deployed:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reserved:    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  maintenance: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  depleted:    "bg-red-500/15 text-red-400 border-red-500/30",
};

const URGENCY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const REQ_STATUS_STYLE: Record<string, string> = {
  pending:      "bg-yellow-500/15 text-yellow-400",
  acknowledged: "bg-blue-500/15 text-blue-400",
  in_progress:  "bg-purple-500/15 text-purple-400",
  fulfilled:    "bg-green-500/15 text-green-400",
  cancelled:    "bg-secondary text-muted-foreground",
};

// ── sub-components ───────────────────────────────────────────────────────────

function StatsBar({ stats, loading }: { stats: ResourceStats | null; loading: boolean }) {
  if (loading || !stats) {
    return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
    </div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
        <p className="text-2xl font-bold text-green-400">{stats.available_count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Available Resources</p>
      </div>
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <p className="text-2xl font-bold text-blue-400">{stats.deployed_count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Deployed</p>
      </div>
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
        <p className="text-2xl font-bold text-yellow-400">{stats.pending_requests}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Pending Requests</p>
      </div>
      <div className={cn("rounded-xl border p-4", stats.critical_requests > 0 ? "border-red-500/30 bg-red-500/10" : "border-border bg-card")}>
        <p className={cn("text-2xl font-bold", stats.critical_requests > 0 ? "text-red-400" : "text-muted-foreground")}>{stats.critical_requests}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Critical Requests</p>
      </div>
    </div>
  );
}

function ResourceCard({ r }: { r: Resource }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[r.resource_type as ResourceType] ?? { label: r.resource_type, icon: Package, color: "text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className={cn("h-4 w-4", meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", STATUS_STYLE[r.status] ?? "bg-secondary text-muted-foreground border-border")}>
              {r.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
              {meta.label}
            </span>
          </div>
          <p className="font-medium text-foreground text-sm leading-tight">{r.name}</p>
          {r.location_name && (
            <p className="text-xs text-muted-foreground mt-0.5">{r.location_name}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">{r.quantity.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{r.unit}</p>
        </div>
      </div>
      {(r.description || r.owner_org) && (
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "Details"}
        </button>
      )}
      {expanded && (
        <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
          {r.description && <p>{r.description}</p>}
          {r.owner_org && <p>Organisation: <span className="text-foreground">{r.owner_org}</span></p>}
          {r.contact && <p>Contact: <a href={`tel:${r.contact}`} className="text-blue-400">{r.contact}</a></p>}
          {r.deployment_notes && <p>Notes: {r.deployment_notes}</p>}
          {r.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {r.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-secondary rounded text-xs">{t}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({ r }: { r: ResourceRequest }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded", URGENCY_STYLE[r.urgency])}>
              {r.urgency.toUpperCase()}
            </span>
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded capitalize">
              {r.category}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded capitalize", REQ_STATUS_STYLE[r.status])}>
              {r.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">{r.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {r.requester_name} · {r.requester_location}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">{r.quantity_needed}</p>
          <p className="text-xs text-muted-foreground">needed</p>
        </div>
      </div>
      {r.responder_notes && (
        <p className="text-xs text-blue-400 bg-blue-500/10 rounded px-2 py-1">
          Responder: {r.responder_notes}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Submitted {new Date(r.created_at).toLocaleString()}
      </p>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  requester_name: "",
  requester_phone: "",
  requester_location: "",
  category: "water" as string,
  quantity_needed: 1,
  description: "",
  incident_id: "",
  urgency: "medium" as string,
};

export default function ResourcesPage() {
  const [tab, setTab] = useState<"availability" | "requests" | "submit">("availability");
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  const { subscribe } = useRealtime();

  // Track online status
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [s, inv, reqs] = await Promise.all([
      fetchResourceStats().catch(() => null),
      fetchResourceInventory({ per_page: 50 }).catch(() => ({ items: [], total: 0, page: 1, per_page: 50, pages: 1 })),
      fetchResourceRequests({ per_page: 50 }).catch(() => ({ items: [], total: 0, page: 1, per_page: 50, pages: 1 })),
    ]);
    setStats(s);
    setResources(inv.items);
    setRequests(reqs.items);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live resource/request updates
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "resource.created" || msg.type === "resource.updated" || msg.type === "resource.assigned") {
        const r = msg.resource as Resource;
        setResources(prev => {
          const exists = prev.find(x => x.id === r.id);
          return exists ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev];
        });
      }
      if (msg.type === "request.created") {
        const req = msg.request as ResourceRequest;
        setRequests(prev => prev.find(x => x.id === req.id) ? prev : [req, ...prev]);
        setStats(s => s ? { ...s, pending_requests: s.pending_requests + 1 } : s);
      }
      if (msg.type === "request.updated") {
        const req = msg.request as ResourceRequest;
        setRequests(prev => prev.map(x => x.id === req.id ? req : x));
      }
    });
  }, [subscribe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requester_name || !form.requester_location || !form.description) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    const payload = {
      ...form,
      incident_id: form.incident_id || undefined,
      requester_phone: form.requester_phone || undefined,
    };
    try {
      if (offline) {
        await enqueueResourceRequest(payload);
        toast.success("Request saved offline", {
          description: "It will be submitted automatically when you reconnect.",
        });
      } else {
        const req = await submitResourceRequest(payload);
        setRequests(prev => [req, ...prev]);
        toast.success("Request submitted", { description: "Emergency responders have been notified." });
      }
      setForm(EMPTY_FORM);
      setTab("requests");
    } catch {
      toast.error("Submission failed", { description: "Please try again or check your connection." });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredResources = resources.filter(r =>
    (!filterType || r.resource_type === filterType) &&
    (!filterStatus || r.status === filterStatus)
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Resource Coordination</h1>
              <p className="text-sm text-muted-foreground">Emergency resources and assistance requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offline && (
              <span className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
            <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar stats={stats} loading={loading} />

        {/* Shortage warning */}
        {stats && stats.shortages.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-red-400">Resource shortage: </span>
              <span className="text-muted-foreground">
                No available {stats.shortages.map(s => s.replace(/_/g, " ")).join(", ")} resources.
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["availability", "requests", "submit"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "submit" ? "Request Assistance" : t.replace("_", " ")}
              {t === "requests" && requests.filter(r => r.status === "pending").length > 0 && (
                <span className="ml-1.5 rounded-full bg-yellow-500 text-black text-xs px-1.5 py-0.5 font-bold">
                  {requests.filter(r => r.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Availability tab ── */}
        {tab === "availability" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                <option value="">All Types</option>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="deployed">Deployed</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
                <option value="depleted">Depleted</option>
              </select>
              <span className="text-sm text-muted-foreground self-center">
                {filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""}
              </span>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />)}
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No resources match your filters.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {filteredResources.map(r => <ResourceCard key={r.id} r={r} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Requests tab ── */}
        {tab === "requests" && (
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />)}
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No assistance requests yet.</p>
              </div>
            ) : (
              requests.map(r => <RequestCard key={r.id} r={r} />)
            )}
          </div>
        )}

        {/* ── Submit request tab ── */}
        {tab === "submit" && (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            {offline && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-400">
                <WifiOff className="h-4 w-4 shrink-0" />
                You&apos;re offline — your request will be queued and sent when connection returns.
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Your Name *</label>
              <input
                type="text" required value={form.requester_name}
                onChange={e => setForm(f => ({ ...f, requester_name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground"
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
              <input
                type="tel" value={form.requester_phone}
                onChange={e => setForm(f => ({ ...f, requester_phone: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground"
                placeholder="+254 7xx xxx xxx"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Your Location *</label>
              <input
                type="text" required value={form.requester_location}
                onChange={e => setForm(f => ({ ...f, requester_location: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground"
                placeholder="Neighbourhood, street, landmark"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Assistance Type *</label>
                <select
                  required value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="food">Food</option>
                  <option value="water">Water</option>
                  <option value="medical">Medical</option>
                  <option value="shelter">Shelter</option>
                  <option value="rescue">Rescue</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Urgency</label>
                <select
                  value={form.urgency}
                  onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity Needed</label>
              <input
                type="number" min={1} value={form.quantity_needed}
                onChange={e => setForm(f => ({ ...f, quantity_needed: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Describe Your Situation *</label>
              <textarea
                required rows={4} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground resize-none"
                placeholder="Explain what you need and how many people are affected..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Related Incident ID (optional)</label>
              <input
                type="text" value={form.incident_id}
                onChange={e => setForm(f => ({ ...f, incident_id: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground"
                placeholder="inc-xxxxxx"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting…" : offline ? "Queue for Later" : "Submit Request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
