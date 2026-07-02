"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users, ShieldCheck, UserCog, Loader2, AlertCircle,
  CheckCircle2, Activity, FileWarning, ArrowRight, Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "RESPONDER" | "ADMIN";
  createdAt: string;
  _count: { incidents: number };
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  RESPONDER: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  USER: "bg-secondary text-muted-foreground border-border",
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/user-dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => {
        if (!r.ok) throw new Error("db");
        return r.json();
      })
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setDbError(true))
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u)));
    }
    setUpdatingId(null);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 ring-1 ring-red-500/40">
            <ShieldCheck className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">User management &amp; system overview</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <Activity className="mr-2 h-3.5 w-3.5" />
              Live Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/user-dashboard">
              <ArrowRight className="mr-2 h-3.5 w-3.5" />
              My Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-blue-400" },
          { label: "Admins", value: roleCounts.ADMIN ?? 0, icon: ShieldCheck, color: "text-red-400" },
          { label: "Responders", value: roleCounts.RESPONDER ?? 0, icon: UserCog, color: "text-orange-400" },
          { label: "Community", value: roleCounts.USER ?? 0, icon: Users, color: "text-green-400" },
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

      {/* User Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCog className="h-4 w-4 text-muted-foreground" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dbError ? (
            <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Database not connected. Set DATABASE_URL and run{" "}
              <code className="font-mono text-xs bg-secondary px-1 rounded">npx prisma migrate dev</code>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading users…</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Joined</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Reports</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-foreground">{u.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell text-xs">
                        {formatRelativeTime(u.createdAt)}
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <FileWarning className="h-3.5 w-3.5" />
                          {u._count.incidents}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        {updatingId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : u.id === session?.user?.id ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> You
                          </span>
                        ) : (
                          <div className="flex gap-1.5">
                            {(["USER", "RESPONDER", "ADMIN"] as const)
                              .filter((r) => r !== u.role)
                              .map((r) => (
                                <button
                                  key={r}
                                  onClick={() => changeRole(u.id, r)}
                                  className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                >
                                  {r}
                                </button>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links to data tools */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/admin/incidents"
          className="flex items-center justify-between rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 hover:bg-orange-500/10 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium text-orange-400">Incident Management</p>
            <p className="text-xs text-muted-foreground">Review, verify &amp; update statuses</p>
          </div>
          <ArrowRight className="h-4 w-4 text-orange-400 group-hover:text-orange-300" />
        </Link>
        <Link
          href="/admin/ai-settings"
          className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 hover:bg-blue-500/10 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium text-blue-400">AI Settings</p>
            <p className="text-xs text-muted-foreground">Provider, model &amp; API key config</p>
          </div>
          <Brain className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-secondary/50 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium">Live Dashboard</p>
            <p className="text-xs text-muted-foreground">Incident feed from all reporters</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link
          href="/ai-summary"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-secondary/50 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium">AI Situation Report</p>
            <p className="text-xs text-muted-foreground">AI risk summary and action plan</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </Link>
      </div>
    </div>
  );
}
