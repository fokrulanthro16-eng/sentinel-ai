"use client";
import { useEffect, useState } from "react";
import { Shelter } from "@/types";
import { fetchShelters } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Phone, Wifi, Utensils, HeartPulse, Droplets } from "lucide-react";

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-3 w-3" />,
  food: <Utensils className="h-3 w-3" />,
  medical: <HeartPulse className="h-3 w-3" />,
  emergency_medical: <HeartPulse className="h-3 w-3" />,
  water: <Droplets className="h-3 w-3" />,
  beds: <Home className="h-3 w-3" />,
};

const STATUS_VARIANT: Record<string, "low" | "medium" | "high" | "critical"> = {
  open: "low",
  nearly_full: "medium",
  full: "high",
  closed: "critical",
};

function OccupancyBar({ capacity, occupancy }: { capacity: number; occupancy: number }) {
  const pct = Math.min(100, Math.round((occupancy / capacity) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{occupancy.toLocaleString()} / {capacity.toLocaleString()}</span>
        <span>{pct}% full</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface ShelterPanelProps {
  shelters?: Shelter[];
}

export default function ShelterPanel({ shelters: propShelters }: ShelterPanelProps) {
  const [shelters, setShelters] = useState<Shelter[]>(propShelters ?? []);
  const [loading, setLoading] = useState(!propShelters);

  useEffect(() => {
    if (propShelters) {
      setShelters(propShelters);
      setLoading(false);
      return;
    }
    fetchShelters().then((data) => {
      setShelters(data);
      setLoading(false);
    });
  }, [propShelters]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shelters & Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Home className="h-4 w-4 text-blue-400" />
          Shelters & Resources
          <Badge variant="secondary" className="ml-auto text-xs">
            {shelters.filter((s) => s.status !== "closed").length} Open
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[520px] overflow-y-auto">
        {shelters.map((shelter) => (
          <div
            key={shelter.id}
            className="rounded-lg border border-border bg-background/50 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium leading-tight">{shelter.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{shelter.address}</p>
              </div>
              <Badge variant={STATUS_VARIANT[shelter.status]} className="shrink-0 text-xs">
                {shelter.status.replace("_", " ")}
              </Badge>
            </div>

            <OccupancyBar capacity={shelter.capacity} occupancy={shelter.current_occupancy} />

            <div className="flex flex-wrap gap-1">
              {shelter.amenities.slice(0, 5).map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {AMENITY_ICONS[a] || null}
                  {a.replace("_", " ")}
                </span>
              ))}
            </div>

            {shelter.contact && (
              <a
                href={`tel:${shelter.contact}`}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <Phone className="h-3 w-3" />
                {shelter.contact}
              </a>
            )}

            {shelter.notes && (
              <p className="text-xs text-muted-foreground italic">{shelter.notes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
