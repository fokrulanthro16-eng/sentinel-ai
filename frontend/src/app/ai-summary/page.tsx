"use client";
import { useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, ListChecks, Wrench, AlertTriangle, Globe2, Bot } from "lucide-react";
import {
  fetchRiskSummary,
  fetchActionRecommendations,
  fetchIncidents,
  generateMultilingualAlert,
} from "@/lib/api";
import { RiskSummary, ActionRecommendations, Incident } from "@/types";
import RiskSummaryCard from "@/components/dashboard/RiskSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TIMEFRAME_COLOR: Record<string, string> = {
  "Immediate": "text-red-400",
  "Within 1 hour": "text-orange-400",
  "Within 6 hours": "text-yellow-400",
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  sw: "Swahili",
  fr: "Français",
  ar: "العربية",
};

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  sw: "🇰🇪",
  fr: "🇫🇷",
  ar: "🇸🇦",
};

export default function AISummaryPage() {
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [recommendations, setRecommendations] = useState<ActionRecommendations | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [multilingualAlert, setMultilingualAlert] = useState<Record<string, string> | null>(null);
  const [activeLang, setActiveLang] = useState<"en" | "sw" | "fr" | "ar">("en");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [sum, rec, inc] = await Promise.all([
      fetchRiskSummary(),
      fetchActionRecommendations(),
      fetchIncidents(),
    ]);
    setSummary(sum);
    setRecommendations(rec);
    setIncidents(inc);

    // Generate multilingual alert from the executive summary
    const title = `${sum.overall_risk_level} Risk Alert — Nairobi`;
    const msg = sum.executive_summary.split(".")[0] + ".";
    const ml = await generateMultilingualAlert(title, msg);
    setMultilingualAlert(ml);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
            <Brain className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Situation Report</h1>
            <p className="text-sm text-muted-foreground">
              Gemini-generated SITREP — synthesises all {incidents.length} active incidents
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
          <p>Gemini is analysing all active incidents…</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top row: Risk Summary + Multilingual Alert */}
          <div className="grid lg:grid-cols-2 gap-5">
            {summary && <RiskSummaryCard summary={summary} />}

            {/* Multilingual Alert */}
            {multilingualAlert && (
              <Card className="border-green-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe2 className="h-4 w-4 text-green-400" />
                    Multilingual Public Alert
                    <Badge variant="secondary" className="ml-auto text-xs flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      AI Generated
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Language tabs */}
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                    {(["en", "sw", "fr", "ar"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setActiveLang(lang)}
                        className={`flex-1 py-2 font-medium transition-colors ${
                          activeLang === lang
                            ? "bg-green-500/20 text-green-400"
                            : "bg-transparent text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {LANG_FLAGS[lang]} {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Alert content */}
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{LANG_FLAGS[activeLang]}</span>
                      <span className="text-xs font-semibold text-green-400">
                        {LANG_LABELS[activeLang]}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {multilingualAlert[activeLang] || multilingualAlert["en"]}
                    </p>
                  </div>

                  {/* All languages preview */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      All Translations
                    </p>
                    {Object.entries(multilingualAlert)
                      .filter(([lang]) => lang !== activeLang && LANG_LABELS[lang])
                      .map(([lang, text]) => (
                        <div
                          key={lang}
                          className="rounded-lg bg-secondary/50 p-2.5 cursor-pointer hover:bg-secondary transition-colors"
                          onClick={() => setActiveLang(lang as "en" | "sw" | "fr" | "ar")}
                        >
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">
                            {LANG_FLAGS[lang]} {LANG_LABELS[lang]}
                          </p>
                          <p className="text-xs text-foreground/80 line-clamp-2">{text}</p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Bottom row: Action Recommendations */}
          {recommendations && (
            <div className="grid lg:grid-cols-2 gap-5">
              {/* Priority Actions */}
              <Card className="border-orange-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ListChecks className="h-4 w-4 text-orange-400" />
                    Priority Action List
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.priority_actions.map((action) => (
                    <div
                      key={action.priority}
                      className="rounded-lg border border-border bg-background/50 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">
                          {action.priority}
                        </span>
                        <div className="space-y-1 flex-1">
                          <p className="text-sm font-semibold text-foreground">{action.action}</p>
                          <p className="text-xs text-muted-foreground">{action.rationale}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <span
                              className={`text-xs font-medium ${TIMEFRAME_COLOR[action.timeframe] || "text-muted-foreground"}`}
                            >
                              ⏱ {action.timeframe}
                            </span>
                            {action.agencies.map((agency) => (
                              <span
                                key={agency}
                                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {agency}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Resource Needs + Coordination */}
              <div className="space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-blue-400" />
                      Resource Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.resource_needs.map((need, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                          {need}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-purple-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-purple-400">
                      <AlertTriangle className="h-4 w-4" />
                      Coordination Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {recommendations.coordination_notes}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
