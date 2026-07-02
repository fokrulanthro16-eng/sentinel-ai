"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, RefreshCw, CheckCircle, Loader2, Search,
  Truck, ChevronDown, ChevronUp, ShieldCheck,
} from "lucide-react";
import {
  fetchResourceInventory, fetchResourceRequests, fetchResourceStats,
  createResource, updateResource, assignResource, updateRequestStatus,
} from "@/lib/api";
import { Resource, ResourceRequest, ResourceStats, ResourceType } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtime } from "@/contexts/RealtimeContext";

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  available:   "bg-green-500/15 text-green-400 border-green-500/30",
  deployed:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reserved:    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  maintenance: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  depleted:    "bg-red-500/15 text-red-400 border-red-500/30",
};

const URGENCY_BADGE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high:     "bg-orange-500/20 text-orange-400",
  medium:   "bg-yellow-500/20 text-yellow-400",
  low:      "bg-blue-500/20 text-blue-400",
};

const REQ_STATUS_OPTS = ["pending", "acknowledged", "in_progress", "fulfilled", "cancelled"];

const RESOURCE_TYPES: ResourceType[] = [
  "food", "water", "medical", "shelter", "rescue_team", "vehicle", "volunteer",
];

// ── Create Resource form (inline) ─────────────────────────────────────────────

const EMPTY_NEW: {
  resource_type: ResourceType;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  owner_org: string;
  contact: string;
  location_name: string;
  tags: string;
} = {
  resource_type: "food",
  name: "",
  description: "",
  quantity: 1,
  unit: "units",
  owner_org: "",
  contact: "",
  location_name: "",
  tags: "",
};

function CreateResourcePanel({ onCreated }: { onCreated: (r: Resource) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const r = await createResource({ ...form, tags });
      onCreated(r);
      toast.success("Resource created");
      setForm(EMPTY_NEW);
      setOpen(false);
    } catch {
      toast.error("Failed to create resource");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors rounded-xl"
      >
        <Plus className="h-4 w-4 text-primary" />
        Add New Resource
        {open ? <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-border p-4 grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type *</label>
            <select
              required value={form.resource_type}
              onChange={e => setForm(f => ({ ...f, resource_type: e.target.value as ResourceType }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name *</label>
            <input
              required type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Resource name"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Description</label>
            <input
              type="text" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Short description"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Quantity *</label>
            <input
              required type="number" min={1} value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Unit</label>
            <input
              type="text" value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="units, persons, litres…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Organisation</label>
            <input
              type="text" value={form.owner_org}
              onChange={e => setForm(f => ({ ...f, owner_org: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Kenya Red Cross…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Contact</label>
            <input
              type="text" value={form.contact}
              onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="+254 …"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Location</label>
            <input
              type="text" value={form.location_name}
              onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Depot, staging area…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
            <input
              type="text" value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="water-rescue, rapid-response"
            />
          </div>
          <div className="sm:col-span-2 flex gap-2 pt-1">
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Resource row ──────────────────────────────────────────────────────────────

function ResourceRow({ r, onUpdated }: { r: Resource; onUpdated: (r: Resource) => void }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(r.quantity));
  const [status, setStatus] = useState(r.status);
  const [incidentId, setIncidentId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateResource(r.id, {
        quantity: Number(qty),
        status: status as Resource["status"],
      });
      onUpdated(updated);
      toast.success("Resource updated");
      setEditing(false);
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!incidentId.trim()) return;
    setSaving(true);
    try {
      const updated = await assignResource(r.id, incidentId.trim());
      onUpdated(updated);
      toast.success(`Assigned to ${incidentId}`);
      setIncidentId("");
    } catch {
      toast.error("Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border bg-card rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", STATUS_STYLE[r.status] ?? "bg-secondary border-border text-muted-foreground")}>
              {r.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded capitalize">
              {r.resource_type.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">{r.name}</p>
          {r.location_name && <p className="text-xs text-muted-foreground">{r.location_name}</p>}
          {r.assigned_incident_id && (
            <p className="text-xs text-blue-400">→ Incident {r.assigned_incident_id}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">{r.quantity.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{r.unit}</p>
        </div>
        <button onClick={() => setEditing(!editing)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
          {editing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {editing && (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Quantity</label>
              <input
                type="number" min={0} value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Resource["status"])}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                <option value="available">Available</option>
                <option value="deployed">Deployed</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
                <option value="depleted">Depleted</option>
              </select>
            </div>
          </div>
          <button
            onClick={save} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Save
          </button>

          <div className="flex gap-2 items-end pt-1 border-t border-border">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-muted-foreground">Assign to Incident ID</label>
              <input
                type="text" value={incidentId}
                onChange={e => setIncidentId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                placeholder="inc-xxxxxx"
              />
            </div>
            <button
              onClick={assign} disabled={saving || !incidentId.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <Truck className="h-3 w-3" /> Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Request management row ────────────────────────────────────────────────────

function RequestRow({ r, onUpdated }: { r: ResourceRequest; onUpdated: (r: ResourceRequest) => void }) {
  const [newStatus, setNewStatus] = useState(r.status);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateRequestStatus(r.id, { status: newStatus, responder_notes: notes || undefined });
      onUpdated(updated);
      toast.success("Request status updated");
      setExpanded(false);
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border bg-card rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs px-2 py-0.5 rounded font-medium", URGENCY_BADGE[r.urgency])}>
              {r.urgency.toUpperCase()}
            </span>
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded capitalize">{r.category}</span>
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded capitalize">{r.status.replace(/_/g," ")}</span>
          </div>
          <p className="text-sm font-medium text-foreground">{r.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {r.requester_name} · {r.requester_location}
            {r.requester_phone && ` · ${r.requester_phone}`}
          </p>
          {r.incident_id && <p className="text-xs text-blue-400">Linked: {r.incident_id}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-foreground">{r.quantity_needed}</p>
          <p className="text-xs text-muted-foreground">needed</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Update Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as ResourceRequest["status"])}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {REQ_STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs text-muted-foreground">Responder Notes</label>
              <input
                type="text" value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                placeholder="Team dispatched, ETA 15 min…"
              />
            </div>
            <button
              onClick={save} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function AdminResourcesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"inventory" | "requests">("inventory");
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const { subscribe } = useRealtime();

  useEffect(() => {
    if (status === "authenticated" && !["ADMIN", "RESPONDER"].includes(session?.user?.role ?? "")) {
      router.replace("/user-dashboard");
    }
  }, [session, status, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [inv, reqs, s] = await Promise.all([
      fetchResourceInventory({ per_page: 100 }).catch(() => ({ items: [] as Resource[], total: 0, page: 1, per_page: 100, pages: 1 })),
      fetchResourceRequests({ per_page: 100 }).catch(() => ({ items: [] as ResourceRequest[], total: 0, page: 1, per_page: 100, pages: 1 })),
      fetchResourceStats().catch(() => null),
    ]);
    setResources(inv.items);
    setRequests(reqs.items);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    return subscribe((msg) => {
      if (["resource.created","resource.updated","resource.assigned"].includes(msg.type)) {
        const r = msg.resource as Resource;
        setResources(prev => prev.find(x => x.id === r.id) ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev]);
      }
      if (msg.type === "request.created") {
        const req = msg.request as ResourceRequest;
        setRequests(prev => [req, ...prev]);
      }
      if (msg.type === "request.updated") {
        const req = msg.request as ResourceRequest;
        setRequests(prev => prev.map(x => x.id === req.id ? req : x));
      }
    });
  }, [subscribe]);

  const filteredResources = resources.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.resource_type.includes(search.toLowerCase())
  );

  const filteredRequests = requests.filter(r =>
    !search || r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.requester_name.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const criticalCount = requests.filter(r => r.urgency === "critical" && r.status !== "fulfilled" && r.status !== "cancelled").length;

  if (status === "loading") return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
            <Package className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Resource Management</h1>
            <p className="text-sm text-muted-foreground">Inventory, deployments and citizen requests</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Mini stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3">
            <p className="text-xl font-bold text-green-400">{stats.available_count}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
            <p className="text-xl font-bold text-blue-400">{stats.deployed_count}</p>
            <p className="text-xs text-muted-foreground">Deployed</p>
          </div>
          <div className={cn("rounded-xl border p-3", pendingCount > 0 ? "border-yellow-500/20 bg-yellow-500/10" : "border-border bg-card")}>
            <p className={cn("text-xl font-bold", pendingCount > 0 ? "text-yellow-400" : "text-muted-foreground")}>{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Requests</p>
          </div>
          <div className={cn("rounded-xl border p-3", criticalCount > 0 ? "border-red-500/20 bg-red-500/10" : "border-border bg-card")}>
            <p className={cn("text-xl font-bold", criticalCount > 0 ? "text-red-400" : "text-muted-foreground")}>{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Critical Unresolved</p>
          </div>
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab("inventory")}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors", tab === "inventory" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            Inventory ({resources.length})
          </button>
          <button
            onClick={() => setTab("requests")}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors", tab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            Requests
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-500 text-black text-xs px-1.5 py-0.5 font-bold">{pendingCount}</span>
            )}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground w-44"
          />
        </div>
      </div>

      {/* Inventory tab */}
      {tab === "inventory" && (
        <div className="space-y-3">
          <CreateResourcePanel onCreated={r => setResources(prev => [r, ...prev])} />
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No resources found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResources.map(r => (
                <ResourceRow key={r.id} r={r} onUpdated={updated => setResources(prev => prev.map(x => x.id === updated.id ? updated : x))} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requests tab */}
      {tab === "requests" && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No requests found.</p>
            </div>
          ) : (
            filteredRequests.map(r => (
              <RequestRow key={r.id} r={r} onUpdated={updated => setRequests(prev => prev.map(x => x.id === updated.id ? updated : x))} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
