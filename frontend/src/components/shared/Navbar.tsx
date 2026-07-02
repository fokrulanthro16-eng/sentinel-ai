"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ShieldAlert, Map, LayoutDashboard, FileWarning, Brain, Database,
  Menu, X, User, LogOut, ShieldCheck, Bell, Package, BarChart2, Cpu,
  Settings, Users, ScrollText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ConnectionStatus from "@/components/shared/ConnectionStatus";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Risk Map", icon: Map },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/resources", label: "Resources", icon: Package },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/report", label: "Report Incident", icon: FileWarning },
  { href: "/ai-summary", label: "AI Summary", icon: Brain },
  { href: "/data-collection", label: "Data Collection", icon: Database },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 ring-1 ring-red-500/40">
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </div>
          <span className="font-bold text-foreground">
            Sentinel <span className="text-red-400">AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {/* Live / connection status */}
          <div className="rounded-full border border-border bg-secondary/40 px-3 py-1.5">
            <ConnectionStatus />
          </div>

          {/* User menu */}
          {session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                  {session.user?.role === "ADMIN" ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <span className="text-muted-foreground max-w-[100px] truncate">
                  {session.user?.name ?? session.user?.email?.split("@")[0]}
                </span>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-border bg-card shadow-xl py-1">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {session.user?.name ?? "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                      <p className="text-xs text-primary mt-0.5">{session.user?.role}</p>
                    </div>
                    {session.user?.role === "ADMIN" ? (
                      <>
                        <Link
                          href="/user-dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <User className="h-3.5 w-3.5" />
                          Profile
                        </Link>
                        <Link
                          href="/admin/ai-settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <Cpu className="h-3.5 w-3.5 text-blue-400" />
                          AI Settings
                        </Link>
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 text-orange-400" />
                          System Settings
                        </Link>
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <Users className="h-3.5 w-3.5 text-green-400" />
                          Users
                        </Link>
                        <Link
                          href="/admin/incidents"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <ScrollText className="h-3.5 w-3.5 text-purple-400" />
                          Audit Logs
                        </Link>
                      </>
                    ) : (
                      <Link
                        href="/user-dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <User className="h-3.5 w-3.5" />
                        My Dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-t border-border mt-1"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 pb-4">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium mt-1",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <div className="border-t border-border mt-3 pt-3">
            {session ? (
              <>
                {session.user?.role === "ADMIN" ? (
                  <>
                    <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {session.user.name ?? "Admin"}
                    </p>
                    <Link href="/user-dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link href="/admin/ai-settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
                      <Cpu className="h-4 w-4 text-blue-400" />
                      AI Settings
                    </Link>
                    <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
                      <Settings className="h-4 w-4 text-orange-400" />
                      System Settings
                    </Link>
                    <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
                      <Users className="h-4 w-4 text-green-400" />
                      Users
                    </Link>
                    <Link href="/admin/incidents" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
                      <ScrollText className="h-4 w-4 text-purple-400" />
                      Audit Logs
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/user-dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
                  >
                    <User className="h-4 w-4" />
                    My Dashboard ({session.user?.role})
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary mt-1"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <User className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
