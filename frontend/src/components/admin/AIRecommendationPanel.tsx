"use client";
import { useState, useEffect } from "react";
import { Incident, TrustResult, AuditLogEntry, ConfidenceLevel } from "@/types";
import TrustScoreBadge from "@/components/shared/TrustScoreBadge";
import {
  recalculateTrust, overrideTrust, fetchAuditLog,
  analyzeIncidentIntelligence,
} from "@/lib/api";
import { IncidentIntelligence } from "@/types/intelligence";
import { formatRelativeTime } from "@/lib/utils";
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Sliders, ShieldCheck,
  Clock, Activity, Eye, AlertCircle,
  FlameKindling, Thermometer, Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; label: string }[] = [
  { value: "low",                label: "Low"                },
  { value: "medium",             label: "Medium"             },
  { value: "high",               label: "High"               },
  { value: "verified_candidate", label: "Verified Candidate" },
];

const ACTION_ICONS: Record<string, string> = {
  trust_calculated:    "📊",
  trust_recalculated:  "🔄",
  status_change:       "🔀",
  override:            "⚙️",
};

interface Props {
  incident: Incident;
  onVerify: () => void;
  onReject: () => void;
  onRefreshIncident: () => void;
}

export default function AIRecommendationPanel({ incident, onVerify, onReject, onRefreshIncident }: Props) {
  const [trust, setTrust] = useState<TrustResult | null>(
    incident.trust_score != null
      ? {
          trust_score: incident.trust_score,
          confidence_level: incident.confidence_level ?? "low",
          validation_reasons: incident.validation_reasons ?? [],
        }
      : null
  );
  const [intel, setIntel] = useState<IncidentIntelligence | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideScore, setOverrideScore] = useState(String(Math.round(incident.trust_score ?? 50)));
  const [overrideLevel, setOverrideLevel] = useState<ConfidenceLevel>(incident.confidence_level ?? "medium");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (!intel) {
      setLoadingIntel(true);
      analyzeIncidentIntelligence(incident.id).then((d) => {
        setIntel(d);
        setLoadingIntel(false);
      });
    }
  }, [incident.id]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await recalculateTrust(incident.id);
      setTrust(result);
      onRefreshIncident();
    } catch {
      // keep existing trust data
    } finally {
      setRecalculating(false);
    }
  };

  const handleAuditToggle = async () => {
    const next = !showAudit;
    setShowAudit(next);
    if (next && auditLog === null) {
      setLoadingAudit(true);
      const log = await fetchAuditLog(incident.id);
      setAuditLog(log);
      setLoadingAudit(false);
    }
  };

  const handleOverrideSave = async () => {
    const score = Number(overrideScore);
    if (isNaN(score) || score < 0 || score > 100) return;
    setSavingOverride(true);
    try {
      const result = await overrideTrust(incident.id, {
        trust_score: score,
        confidence_level: overrideLevel,
        notes: overrideNotes || undefined,
        actor: "admin",
      });
      setTrust(result);
      setShowOverride(false);
      onRefreshIncident();
    } catch {
      // ignore
    } finally {
      setSavingOverride(false);
    }
  };

  const displayTrust = trust ?? {
    trust_score: incident.trust_score,
    confidence_level: incident.confidence_level ?? "low",
    validation_reasons: incident.validation_reasons ?? [],
  };

  return (
    <div className="space-y-4">
      {/* Trust Score + Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Badge */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <TrustScoreBadge
            trust_score={displayTrust.trust_score}
            confidence_level={displayTrust.confidence_level}
            size="lg"
          />
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {recalculating
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            Recalculate
          </button>
        </div>

        {/* Validation Reasons */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Trust Signals
          </p>
          {(displayTrust.validation_reasons ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No validation signals yet — run Recalculate.</p>
          ) : (
            <ul className="space-y-1">
              {(displayTrust.validation_reasons ?? []).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 shrink-0">
          {incident.status !== "verified" && (
            <Button size="sm" onClick={onVerify} className="bg-green-600 hover:bg-green-700 text-white">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Approve & Verify
            </Button>
          )}
          {incident.status !== "resolved" && (
            <Button size="sm" variant="outline" onClick={onReject} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Reject / Resolve
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowOverride(!showOverride)}>
            <Sliders className="h-3.5 w-3.5 mr-1.5" />
            Override Score
          </Button>
        </div>
      </div>

      {/* Override form */}
      {showOverride && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Override</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Trust Score (0–100)</label>
              <input
                type="number" min="0" max="100"
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Confidence Level</label>
              <select
                value={overrideLevel}
                onChange={(e) => setOverrideLevel(e.target.value as ConfidenceLevel)}
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CONFIDENCE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Reason for override (optional)</label>
            <input
              type="text"
              placeholder="e.g. Field team confirmed incident on site"
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowOverride(false)}>Cancel</Button>
            <Button size="sm" disabled={savingOverride} onClick={handleOverrideSave}>
              {savingOverride && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Save Override
            </Button>
          </div>
        </div>
      )}

      {/* AI Intelligence Analysis */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">AI Intelligence Analysis</p>
          {loadingIntel && <Loader2 className="h-3 w-3 animate-spin text-blue-400 ml-auto" />}
        </div>
        {intel ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">{intel.summary}</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Thermometer className="h-3 w-3 text-orange-400 shrink-0" />
                <span>Risk: <span className="font-semibold text-foreground">{Math.round(intel.risk_score * 100)}%</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FlameKindling className="h-3 w-3 text-red-400 shrink-0" />
                <span>{intel.fire_hotspot_count} hotspot{intel.fire_hotspot_count !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Droplets className="h-3 w-3 text-blue-400 shrink-0" />
                <span>{intel.nearby_report_count} corroborating</span>
              </div>
            </div>
            {intel.recommended_actions?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Recommended Actions:</p>
                <ul className="space-y-1">
                  {intel.recommended_actions.slice(0, 3).map((a, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-blue-400 shrink-0">{i + 1}.</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/50 pt-2">
              <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
              AI analysis is advisory only. Admin/Responder must make final verification decision.
            </div>
          </>
        ) : !loadingIntel ? (
          <p className="text-xs text-muted-foreground">Intelligence analysis unavailable.</p>
        ) : null}
      </div>

      {/* Audit Log */}
      <div>
        <button
          onClick={handleAuditToggle}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showAudit
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="font-medium">Audit Log</span>
          {loadingAudit && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
        </button>
        {showAudit && (
          <div className="mt-2 space-y-1.5">
            {auditLog === null || auditLog.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 pl-5">No audit entries yet.</p>
            ) : (
              auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5 text-xs pl-5">
                  <span className="shrink-0 mt-0.5">{ACTION_ICONS[entry.action] ?? "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-foreground capitalize">
                        {entry.action.replace(/_/g, " ")}
                      </span>
                      {entry.new_status && (
                        <span className="text-muted-foreground">
                          → <span className="text-foreground capitalize">{entry.new_status.replace("_", " ")}</span>
                        </span>
                      )}
                      {entry.trust_score_after != null && (
                        <span className="text-blue-400">
                          Trust: {Math.round(entry.trust_score_after)}
                          {entry.trust_score_before != null && entry.trust_score_before !== entry.trust_score_after
                            ? ` (was ${Math.round(entry.trust_score_before)})`
                            : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      {formatRelativeTime(entry.timestamp)}
                      {entry.actor && entry.actor !== "system" && (
                        <> · by <span className="text-foreground">{entry.actor}</span></>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-muted-foreground/80 mt-0.5 truncate">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
