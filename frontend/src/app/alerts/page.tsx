"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, AlertTriangle, Clock, MapPin, CheckCircle, XCircle, Wifi, Mail, MessageCircle, Filter, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchAlerts, fetchAlertHistory, dismissAlert } from "@/lib/api";
import { Alert, PaginatedAlerts } from "@/types";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-red-500 bg-red-500/10 text-red-400",
  high: "border-orange-500 bg-orange-500/10 text-orange-400",
  medium: "border-yellow-500 bg-yellow-500/10 text-yellow-400",
  low: "border-blue-500 bg-blue-500/10 text-blue-400",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const DELIVERY_ICONS: Record<string, React.ReactNode> = {
  sms: <MessageCircle className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  dashboard: <Bell className="h-3.5 w-3.5" />,
  websocket: <Wifi className="h-3.5 w-3.5" />,
};

type Language = "en" | "sw" | "fr" | "ar";

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss?: (id: string) => void }) {
  const [lang, setLang] = useState<Language>("en");
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const langs: { code: Language; label: string }[] = [
    { code: "en", label: "EN" },
    ...(alert.message_sw ? [{ code: "sw" as Language, label: "SW" }] : []),
    ...(alert.message_fr ? [{ code: "fr" as Language, label: "FR" }] : []),
    ...(alert.message_ar ? [{ code: "ar" as Language, label: "AR" }] : []),
  ];

  const message =
    lang === "sw" ? alert.message_sw :
    lang === "fr" ? alert.message_fr :
    lang === "ar" ? alert.message_ar :
    alert.message_en;

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await dismissAlert(alert.id);
      onDismiss?.(alert.id);
    } catch {
      setDismissing(false);
    }
  };

  return (
    <div className={cn("rounded-xl border-l-4 border border-border bg-card p-4 space-y-3", SEVERITY_COLORS[alert.severity])}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", SEVERITY_BADGE[alert.severity])}>
              {alert.severity.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
              {alert.category}
            </span>
            {alert.ai_generated && (
              <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                AI Generated
              </span>
            )}
            {!alert.active && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                Dismissed
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground leading-tight">{alert.title}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {alert.active && onDismiss && (
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Dismiss alert"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Language selector */}
      {langs.length > 1 && (
        <div className="flex gap-1">
          {langs.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={cn(
                "text-xs px-2 py-0.5 rounded border transition-colors",
                lang === code
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Message */}
      <p className={cn("text-sm text-foreground/80 leading-relaxed", lang === "ar" && "text-right")} dir={lang === "ar" ? "rtl" : "ltr"}>
        {message}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(alert.issued_at).toLocaleString()}
        </span>
        {alert.affected_areas?.length > 0 && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {alert.affected_areas.join(", ")}
          </span>
        )}
        {alert.radius_km && (
          <span className="text-xs">Radius: {alert.radius_km} km</span>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary hover:underline"
      >
        {expanded ? "Show less" : "Show details"}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1 border-t border-border">
          {/* Recommended actions */}
          {alert.recommended_actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Recommended Actions</p>
              <ul className="space-y-1">
                {alert.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evacuation guidance */}
          {alert.evacuation_guidance && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Evacuation Guidance</p>
              <p className="text-xs text-muted-foreground">{alert.evacuation_guidance}</p>
            </div>
          )}

          {/* Public safety message */}
          {alert.public_safety_message && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-primary mb-1">Public Safety Message</p>
              <p className="text-xs text-muted-foreground">{alert.public_safety_message}</p>
            </div>
          )}

          {/* Delivery status */}
          {Object.keys(alert.delivery_status ?? {}).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Notification Delivery</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(alert.delivery_status).map(([channel, status]) => (
                  <span
                    key={channel}
                    className={cn(
                      "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border",
                      status === "failed"
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-green-500/30 bg-green-500/10 text-green-400"
                    )}
                  >
                    {DELIVERY_ICONS[channel] ?? <Bell className="h-3.5 w-3.5" />}
                    <span className="capitalize">{channel}</span>
                    <span className="opacity-70">·</span>
                    <span>{status}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<PaginatedAlerts | null>(null);
  const [loading, setLoading] = useState(true);

  // History filters
  const [severity, setSeverity] = useState("");
  const [district, setDistrict] = useState("");
  const [histPage, setHistPage] = useState(1);

  const loadActive = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts();
      setActiveAlerts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAlertHistory({
        page: histPage,
        per_page: 10,
        severity: severity || undefined,
        district: district || undefined,
      });
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }, [histPage, severity, district]);

  useEffect(() => {
    if (tab === "active") loadActive();
    else loadHistory();
  }, [tab, loadActive, loadHistory]);

  const handleDismiss = (id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
              <Bell className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Alert Center</h1>
              <p className="text-sm text-muted-foreground">Real-time emergency alerts for Nairobi</p>
            </div>
          </div>
          <button
            onClick={tab === "active" ? loadActive : loadHistory}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab("active")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Active Alerts
            {activeAlerts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5">
                {activeAlerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Alert History
          </button>
        </div>

        {/* History filters */}
        {tab === "history" && (
          <div className="flex flex-wrap gap-3 items-center bg-card border border-border rounded-xl p-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setHistPage(1); }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="text"
              placeholder="Filter by district..."
              value={district}
              onChange={(e) => { setDistrict(e.target.value); setHistPage(1); }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground flex-1 min-w-[150px]"
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-28" />
            ))}
          </div>
        ) : tab === "active" ? (
          activeAlerts.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">No active alerts</p>
              <p className="text-sm mt-1">The system will alert you when emergency conditions are detected.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
              ))}
            </div>
          )
        ) : (
          history && (
            <div className="space-y-4">
              <div className="space-y-3">
                {history.items.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No alerts found</p>
                    <p className="text-sm mt-1">Try adjusting your filters.</p>
                  </div>
                ) : (
                  history.items.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                )}
              </div>

              {/* Pagination */}
              {history.pages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {history.total} alerts · Page {history.page} of {history.pages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                      disabled={histPage === 1}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </button>
                    <button
                      onClick={() => setHistPage((p) => Math.min(history.pages, p + 1))}
                      disabled={histPage === history.pages}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
