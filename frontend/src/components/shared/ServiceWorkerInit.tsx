"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { flushQueue, flushRequestQueue } from "@/lib/offline-queue";

export default function ServiceWorkerInit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // When a new SW version activates (new build), auto-reload so stale
    // cached assets are never used. Guard: only if a controller already
    // existed — avoids reloading on the very first SW install.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Send the API URL so background sync knows where to POST
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const sendMeta = (sw: ServiceWorker | null) => {
          sw?.postMessage({ type: "SET_API_URL", url: apiUrl });
        };
        sendMeta(reg.active ?? reg.installing ?? reg.waiting);
        reg.addEventListener("updatefound", () => sendMeta(reg.installing));
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));

    // SW notified us that a queued incident was synced
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        toast.success("Offline report submitted", {
          description: "A queued incident was successfully sent to the server.",
        });
      }
    });

    // Fallback: flush both queues on reconnect if Background Sync API isn't available
    const handleOnline = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const [incCount, reqCount] = await Promise.all([
        flushQueue(apiUrl).catch(() => 0),
        flushRequestQueue(apiUrl).catch(() => 0),
      ]);
      const total = incCount + reqCount;
      if (total > 0) {
        toast.success(`${total} offline submission${total > 1 ? "s" : ""} sent`, {
          description: [
            incCount > 0 ? `${incCount} incident report${incCount > 1 ? "s" : ""}` : "",
            reqCount > 0 ? `${reqCount} resource request${reqCount > 1 ? "s" : ""}` : "",
          ].filter(Boolean).join(" and ") + " synced.",
        });
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
