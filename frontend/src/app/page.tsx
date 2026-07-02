import Link from "next/link";
import {
  ShieldAlert, Map, LayoutDashboard, FileWarning, Brain,
  Zap, Globe2, Users, ArrowRight, CheckCircle2,
  Activity, Shield, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { label: "Incidents Tracked", value: "8" },
  { label: "People Protected", value: "14K+" },
  { label: "Active Alerts", value: "5" },
  { label: "Shelters Open", value: "5 / 6" },
];

const FEATURES = [
  {
    icon: Brain,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    title: "AI-Powered Classification",
    desc: "Gemini AI instantly categorises every community report, assigns severity, and routes it to the correct authority — in seconds.",
  },
  {
    icon: Globe2,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    title: "Multilingual Alerts",
    desc: "Emergency alerts auto-translated into English, Swahili, French, and Arabic so no community is left behind.",
  },
  {
    icon: Map,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    title: "Live Risk Map",
    desc: "Interactive Leaflet map shows live incidents colour-coded by severity, with shelter locations and real-time status.",
  },
  {
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    title: "Action Recommendations",
    desc: "AI synthesises all active incidents and generates a prioritised action list with agencies and timeframes for emergency coordinators.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: FileWarning,
    title: "Community Reports",
    desc: "Anyone submits an incident via the report form — in any language, from any device. Photo evidence supported.",
  },
  {
    step: "2",
    icon: Brain,
    title: "AI Classifies",
    desc: "Gemini AI categorises, assigns severity, and generates multilingual alerts automatically within seconds.",
  },
  {
    step: "3",
    icon: Shield,
    title: "Authorities Act",
    desc: "The dashboard delivers AI-prioritised actions to the right agencies with resource needs and coordination notes.",
  },
];

const INCIDENT_TYPES = [
  { emoji: "🌊", label: "Flash Flood" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🏥", label: "Medical" },
  { emoji: "🏗️", label: "Infrastructure" },
  { emoji: "⚠️", label: "Civil Unrest" },
  { emoji: "☠️", label: "Contamination" },
  { emoji: "⚡", label: "Power Outage" },
  { emoji: "⛰️", label: "Landslide" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 text-center">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] rounded-full bg-red-500/8 blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-blue-500/6 blur-[100px]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[200px] rounded-full bg-orange-500/5 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-sm text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live Emergency Response Platform — Nairobi, Kenya
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Sentinel{" "}
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              AI
            </span>
            <br />
            Community ActionGrid
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
            A real-time disaster response platform that turns community incident reports into
            AI-powered insights, multilingual alerts, and coordinated emergency action — at scale.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Open Dashboard
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/report">
                <FileWarning className="mr-2 h-4 w-4" />
                Report Incident
              </Link>
            </Button>
          </div>

          {/* Quick nav chips */}
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {[
              { href: "/map", label: "Risk Map", icon: Map },
              { href: "/ai-summary", label: "AI SITREP", icon: Brain },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Icon className="h-3 w-3" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-secondary/30 py-6">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Incident types ticker */}
      <section className="border-b border-border bg-background/50 py-3 overflow-hidden">
        <div className="flex gap-6 px-4 overflow-x-auto no-scrollbar">
          {INCIDENT_TYPES.map(({ emoji, label }) => (
            <div key={label} className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
              <span className="text-base">{emoji}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Built for real emergencies</h2>
            <p className="mt-2 text-muted-foreground">
              Every feature designed with community resilience at its core
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className={`rounded-xl border p-6 space-y-3 ${f.bg}`}>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 bg-secondary/20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground">From community report to coordinated response in minutes</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((item, idx) => (
              <div key={item.step} className="relative space-y-3 text-center">
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-border" />
                )}
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 border border-primary/30 relative z-10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  Step {item.step}
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Activity, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", title: "Real-Time Monitoring", desc: "Dashboard refreshes on demand with live incident counts and severity breakdowns." },
              { icon: Bell, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", title: "Multi-Channel Alerts", desc: "Alerts broadcast in English, Swahili, French, and Arabic simultaneously." },
              { icon: Users, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", title: "Community-Driven", desc: "Anyone can report — no registration required. Reports are anonymous by default." },
            ].map((item) => (
              <div key={item.title} className={`rounded-xl border p-5 ${item.bg}`}>
                <item.icon className={`h-6 w-6 ${item.color} mb-3`} />
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center bg-secondary/20">
        <div className="mx-auto max-w-xl space-y-5">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/30">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <h2 className="text-3xl font-bold">Ready to respond?</h2>
          <p className="text-muted-foreground">
            View the live dashboard to see all active incidents, AI risk analysis, multilingual alerts, and shelter status.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/ai-summary">
                <Brain className="mr-2 h-4 w-4" />
                View AI SITREP
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <span className="font-semibold text-foreground">Sentinel AI</span>
            <span>— Community ActionGrid · Hackathon MVP</span>
          </div>
          <div className="flex gap-5">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/map" className="hover:text-foreground transition-colors">Risk Map</Link>
            <Link href="/report" className="hover:text-foreground transition-colors">Report</Link>
            <Link href="/ai-summary" className="hover:text-foreground transition-colors">AI Summary</Link>
          </div>
          <span>Powered by Gemini AI + Next.js 14</span>
        </div>
      </footer>
    </div>
  );
}
