"use client";
import { ConfidenceLevel } from "@/types";

const LEVEL_META: Record<ConfidenceLevel, { label: string; color: string; bg: string; ring: string }> = {
  low:                { label: "Low Trust",           color: "#ef4444", bg: "bg-red-500/10",    ring: "ring-red-500/30"    },
  medium:             { label: "Medium Trust",         color: "#f97316", bg: "bg-orange-500/10", ring: "ring-orange-500/30" },
  high:               { label: "High Trust",           color: "#3b82f6", bg: "bg-blue-500/10",   ring: "ring-blue-500/30"   },
  verified_candidate: { label: "Verified Candidate",  color: "#22c55e", bg: "bg-green-500/10",  ring: "ring-green-500/30"  },
};

interface TrustScoreBadgeProps {
  trust_score?: number;
  confidence_level?: ConfidenceLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function TrustScoreBadge({
  trust_score,
  confidence_level = "low",
  size = "md",
  showLabel = true,
}: TrustScoreBadgeProps) {
  if (trust_score == null) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  const meta = LEVEL_META[confidence_level] ?? LEVEL_META.low;
  const score = Math.round(trust_score);

  const dims = size === "sm"
    ? { ring: 28, stroke: 3, font: "text-[9px]", label: "text-[9px]" }
    : size === "lg"
    ? { ring: 64, stroke: 5, font: "text-base",  label: "text-xs"    }
    : { ring: 40, stroke: 4, font: "text-[10px]", label: "text-[10px]" };

  const r = (dims.ring / 2) - dims.stroke;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: dims.ring, height: dims.ring }}>
        <svg width={dims.ring} height={dims.ring} className="-rotate-90">
          <circle
            cx={dims.ring / 2} cy={dims.ring / 2} r={r}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth={dims.stroke}
          />
          <circle
            cx={dims.ring / 2} cy={dims.ring / 2} r={r}
            fill="none"
            stroke={meta.color}
            strokeWidth={dims.stroke}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums ${dims.font}`}
          style={{ color: meta.color }}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <span className={`font-medium ${dims.label}`} style={{ color: meta.color }}>
          {meta.label}
        </span>
      )}
    </div>
  );
}
