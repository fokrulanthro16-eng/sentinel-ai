import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Severity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export const SEVERITY_BG: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};

export const INCIDENT_ICONS: Record<string, string> = {
  flood: "🌊",
  fire: "🔥",
  medical: "🏥",
  infrastructure: "🏗️",
  civil_unrest: "⚠️",
  contamination: "☠️",
  power_outage: "⚡",
  landslide: "⛰️",
  other: "📍",
};

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
