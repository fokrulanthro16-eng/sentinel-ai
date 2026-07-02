"use client";
import { Alert } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Bot, Globe } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { useState } from "react";

interface AlertsFeedProps {
  alerts: Alert[];
}

export default function AlertsFeed({ alerts }: AlertsFeedProps) {
  const [activeLang, setActiveLang] = useState<"en" | "sw" | "fr">("en");

  const getMessage = (alert: Alert): string => {
    if (activeLang === "sw" && alert.message_sw) return alert.message_sw;
    if (activeLang === "fr" && alert.message_fr) return alert.message_fr;
    return alert.message_en;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-orange-400" />
            Active Alerts
            <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
          </CardTitle>
          {/* Language toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["en", "sw", "fr"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-2 py-1 font-medium transition-colors ${
                  activeLang === lang
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-secondary"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[400px]">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-lg border border-border bg-background/50 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {alert.ai_generated && (
                  <Bot className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                )}
                <p className="text-xs font-semibold text-foreground leading-tight truncate">
                  {alert.title}
                </p>
              </div>
              <Badge
                variant={alert.severity as "critical" | "high" | "medium" | "low"}
                className="shrink-0 text-xs"
              >
                {alert.severity}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{getMessage(alert)}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {alert.source}
              </span>
              <span>{formatRelativeTime(alert.issued_at)}</span>
            </div>

            {alert.affected_areas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {alert.affected_areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {area}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
