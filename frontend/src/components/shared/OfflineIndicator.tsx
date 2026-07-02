"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOffline = () => {
      setOffline(true);
      toast.warning("You are offline", {
        id:          "offline-banner",
        description: "Incident reports will be queued and sent when you reconnect.",
        duration:    Infinity,
      });
    };

    const onOnline = () => {
      setOffline(false);
      toast.dismiss("offline-banner");
      toast.success("Connection restored", { duration: 3_000 });
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online",  onOnline);
    if (!navigator.onLine) onOffline();

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online",  onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-16 z-50 flex items-center justify-center gap-2 bg-orange-600/95 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm print:hidden"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      You are offline — reports are being saved locally
    </div>
  );
}
