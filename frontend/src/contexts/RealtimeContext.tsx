"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

export type WSStatus = "connecting" | "connected" | "disconnected" | "error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageHandler = (msg: Record<string, any>) => void;

interface RealtimeContextValue {
  status: WSStatus;
  onlineCount: number;
  subscribe: (handler: MessageHandler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "disconnected",
  onlineCount: 0,
  subscribe: () => () => {},
});

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const ws = base.replace(/^http/, "ws");
  return ws.endsWith("/ws") ? ws : `${ws}/ws`;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [onlineCount, setOnlineCount] = useState(0);

  const ws = useRef<WebSocket | null>(null);
  const handlers = useRef<Set<MessageHandler>>(new Set());
  const attempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(false);

  const connect = useCallback(() => {
    if (!alive.current) return;
    setStatus("connecting");

    const socket = new WebSocket(getWsUrl());
    ws.current = socket;

    socket.onopen = () => {
      if (!alive.current) { socket.close(); return; }
      setStatus("connected");
      attempts.current = 0;
    };

    socket.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as Record<string, unknown>;
        const t = msg.type as string;

        if (t === "connected") {
          setOnlineCount((msg.online_count as number) ?? 0);
          return;
        }
        if (t === "online_count") {
          setOnlineCount((msg.count as number) ?? 0);
          return;
        }
        if (t === "pong") return;

        // Public alert toast — only for verified or high-trust/critical incidents
        if (t === "incident.created") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inc = msg.incident as any;
          const isPublicAlert = msg.is_public_alert as boolean;
          if (isPublicAlert) {
            const sev: string = inc?.severity ?? "medium";
            if (sev === "critical" || sev === "high") {
              toast.error(`New ${sev} incident`, {
                description: `${inc?.title} — ${inc?.location_name ?? ""}`,
                duration: 8_000,
              });
            } else {
              toast.info(`New verified incident`, {
                description: inc?.title,
                duration: 5_000,
              });
            }
          }
        }

        // Resource request toast — notify responders of new critical requests
        if (t === "request.created") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const req = msg.request as any;
          if (req?.urgency === "critical" || req?.urgency === "high") {
            toast.warning(`New ${req.urgency} resource request`, {
              description: `${req.category?.toUpperCase()} — ${req.requester_location ?? ""}`,
              duration: 8_000,
            });
          }
        }

        // Alert toast for newly generated alerts
        if (t === "alert.created") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const alert = msg.alert as any;
          const sev: string = alert?.severity ?? "medium";
          const severityColor = sev === "critical" || sev === "high" ? "error" : "warning";
          if (severityColor === "error") {
            toast.error(`ALERT: ${alert?.title ?? "Emergency Alert"}`, {
              description: alert?.message_en ?? "",
              duration: 12_000,
            });
          } else {
            toast.warning(`ALERT: ${alert?.title ?? "Emergency Alert"}`, {
              description: alert?.message_en ?? "",
              duration: 8_000,
            });
          }
        }

        handlers.current.forEach((h) => h(msg as Record<string, any>));
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      if (!alive.current) return;
      setStatus("disconnected");
      const delay = Math.min(1_000 * 2 ** attempts.current++, 30_000);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      setStatus("error");
      socket.close();
    };
  }, []); // stable — all mutable state via refs

  useEffect(() => {
    alive.current = true;
    connect();

    const ping = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      }
    }, 25_000);

    return () => {
      alive.current = false;
      clearInterval(ping);
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((handler: MessageHandler) => {
    handlers.current.add(handler);
    return () => { handlers.current.delete(handler); };
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, onlineCount, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
