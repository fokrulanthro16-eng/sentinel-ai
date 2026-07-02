"use client";
import { RiskSummary as RiskSummaryType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, AlertTriangle, Users, MapPin, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const RISK_STYLE = {
  CRITICAL: "text-red-400 border-red-500/30 bg-red-500/10",
  HIGH: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  MEDIUM: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  LOW: "text-green-400 border-green-500/30 bg-green-500/10",
};

interface RiskSummaryProps {
  summary: RiskSummaryType;
  loading?: boolean;
}

export default function RiskSummary({ summary, loading = false }: RiskSummaryProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-400 animate-pulse" />
            AI Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-5 rounded bg-secondary animate-pulse w-1/3" />
            <div className="h-16 rounded bg-secondary animate-pulse" />
            <div className="h-4 rounded bg-secondary animate-pulse w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-blue-400" />
          AI Risk Summary
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(summary.generated_at)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Level Badge */}
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold",
            RISK_STYLE[summary.overall_risk_level]
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          {summary.overall_risk_level} RISK
        </div>

        {/* Executive Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {summary.executive_summary}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" />
              Population at Risk
            </div>
            <p className="text-lg font-bold">{summary.population_at_risk.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <MapPin className="h-3.5 w-3.5" />
              Hotspots
            </div>
            <p className="text-sm font-semibold">{summary.incident_hotspots.join(", ")}</p>
          </div>
        </div>

        {/* Key Threats */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Key Threats
          </p>
          <ul className="space-y-1">
            {summary.key_threats.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Forecast */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            6-12 Hour Forecast
          </p>
          <p className="text-xs text-muted-foreground">{summary.forecast}</p>
        </div>

        {/* Immediate Priorities */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Immediate Priorities
          </p>
          <ol className="space-y-1.5">
            {summary.immediate_priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
