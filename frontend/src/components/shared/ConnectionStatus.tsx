"use client";
import { useRealtime, type WSStatus } from "@/contexts/RealtimeContext";

const CONFIG: Record<WSStatus, { dot: string; text: string; label: string; ping: boolean }> = {
  connected:    { dot: "bg-green-400",           text: "text-green-400",           label: "Live",         ping: true  },
  connecting:   { dot: "bg-yellow-400",          text: "text-yellow-400",          label: "Connecting",   ping: false },
  disconnected: { dot: "bg-muted-foreground",     text: "text-muted-foreground",     label: "Reconnecting", ping: false },
  error:        { dot: "bg-red-500",             text: "text-red-400",             label: "Offline",      ping: false },
};

export default function ConnectionStatus() {
  const { status, onlineCount } = useRealtime();
  const c = CONFIG[status];

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <span className="relative flex h-2 w-2 shrink-0">
        {c.ping && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      <span className={c.text}>{c.label}</span>
      {status === "connected" && onlineCount > 0 && (
        <span className="text-muted-foreground tabular-nums">· {onlineCount}</span>
      )}
    </div>
  );
}
