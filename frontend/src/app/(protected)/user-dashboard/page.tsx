"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  User, FileWarning, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, Loader2, Activity, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

interface UserIncident {
  id: string;
  incidentId: string;
  title: string;
  severity: string;
  locationName: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  RESPONDER: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  USER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export default function UserDashboardPage() {
  const { data: session, status } = useSession();
  const [incidents, setIncidents] = useState<UserIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    fetch("/api/user/incidents")
      .then((r) => {
        if (!r.ok) throw new Error("db");
        return r.json();
      })
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => setDbError(true))
      .finally(() => setLoading(false));
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const user = session?.user;
  const severityCounts = incidents.reduce<Record<string, number>>((acc, inc) => {
    acc[inc.severity] = (acc[inc.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "My Dashboard"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.role && (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role] ?? ROLE_COLORS.USER}`}>
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href="/report">
            <FileWarning className="mr-2 h-4 w-4" />
            Report Incident
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Reports", value: incidents.length, icon: FileWarning, color: "text-blue-400" },
          { label: "Critical", value: severityCounts.critical ?? 0, icon: AlertTriangle, color: "text-red-400" },
          { label: "High", value: severityCounts.high ?? 0, icon: Activity, color: "text-orange-400" },
          { label: "Low / Medium", value: (severityCounts.medium ?? 0) + (severityCounts.low ?? 0), icon: Eye, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Incidents table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            My Submitted Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dbError ? (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-400">
              Database not connected. Set DATABASE_URL and run{" "}
              <code className="font-mono text-xs bg-secondary px-1 rounded">npx prisma migrate dev</code>{" "}
              to enable incident tracking.
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading your incidents…</span>
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <FileWarning className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No incidents reported yet.</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/report">Report your first incident</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${SEVERITY_DOT[inc.severity] ?? "bg-muted"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inc.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{inc.locationName}</p>
                  </div>
                  <Badge variant={inc.severity as "critical" | "high" | "medium" | "low"} className="shrink-0">
                    {inc.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {formatRelativeTime(inc.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { href: "/dashboard", label: "Live Dashboard", desc: "View all active incidents", icon: Activity },
          { href: "/map", label: "Risk Map", desc: "See incidents on the map", icon: Eye },
          { href: "/ai-summary", label: "AI SITREP", desc: "AI risk analysis", icon: CheckCircle2 },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-secondary/50 transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{link.label}</p>
              <p className="text-xs text-muted-foreground">{link.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        ))}
      </div>

      {user?.role === "ADMIN" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-400">Admin access</p>
            <p className="text-xs text-muted-foreground">Manage users and system settings</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin">
              Admin Panel <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
