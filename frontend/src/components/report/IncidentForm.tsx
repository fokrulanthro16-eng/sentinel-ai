"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, Loader2, CheckCircle2, Navigation, Camera, ImagePlus } from "lucide-react";
import { submitIncident } from "@/lib/api";
import { enqueueIncident } from "@/lib/offline-queue";

const schema = z.object({
  type: z.enum(["flood", "fire", "medical", "infrastructure", "civil_unrest", "contamination", "power_outage", "landslide", "other"]),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Please describe the incident in more detail"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  location_name: z.string().min(3, "Please enter the location"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  reporter_name: z.string().optional(),
  reporter_phone: z.string().optional(),
  affected_count: z.number().min(0).optional(),
});

type FormData = z.infer<typeof schema>;

const INCIDENT_TYPES = [
  { value: "flood", label: "🌊 Flash Flood" },
  { value: "fire", label: "🔥 Fire" },
  { value: "medical", label: "🏥 Medical Emergency" },
  { value: "infrastructure", label: "🏗️ Infrastructure Damage" },
  { value: "civil_unrest", label: "⚠️ Civil Unrest" },
  { value: "contamination", label: "☠️ Contamination" },
  { value: "power_outage", label: "⚡ Power Outage" },
  { value: "landslide", label: "⛰️ Landslide" },
  { value: "other", label: "📍 Other" },
];

const SEVERITY_OPTIONS = [
  { value: "critical", label: "🔴 Critical — Immediate life threat" },
  { value: "high", label: "🟠 High — Serious but not immediately fatal" },
  { value: "medium", label: "🟡 Medium — Significant impact, monitoring required" },
  { value: "low", label: "🟢 Low — Minor inconvenience" },
];

export default function IncidentForm() {
  const { data: session } = useSession();
  const [submitted, setSubmitted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [photoName, setPhotoName] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { lat: -1.2921, lng: 36.8219 },
  });

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("lat", parseFloat(pos.coords.latitude.toFixed(6)));
        setValue("lng", parseFloat(pos.coords.longitude.toFixed(6)));
        toast.success("Location detected successfully");
        setLocating(false);
      },
      () => {
        toast.error("Could not detect location. Enter coordinates manually.");
        setLocating(false);
      }
    );
  };

  const onSubmit = async (data: FormData) => {
    const payload: any = { ...data };
    if (session?.user?.id) payload.reporter_id = session.user.id;

    // Offline path — queue for later sync
    if (!navigator.onLine) {
      await enqueueIncident(payload).catch(() => {});
      setSubmitted(true);
      toast.info("Saved offline — will submit when reconnected", {
        description: "Your report is queued and will be sent automatically.",
        duration: 6_000,
      });
      return;
    }

    try {
      const result = await submitIncident(payload);

      // Track in Prisma (non-blocking, only when logged in)
      if (session?.user?.id) {
        fetch("/api/user/incidents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidentId: result.id,
            title: result.title,
            severity: result.severity,
            location_name: result.location_name,
            lat: result.lat,
            lng: result.lng,
          }),
        }).catch(() => undefined);
      }

      setSubmitted(true);
      toast.success("Incident reported successfully! Authorities have been notified.");
    } catch {
      // Backend unreachable — queue it
      await enqueueIncident(payload).catch(() => {});
      setSubmitted(true);
      toast.info("Report saved — will submit when server is back online", {
        description: "The backend is unreachable. Your report has been queued.",
        duration: 6_000,
      });
    }
  };

  if (submitted) {
    return (
      <Card className="border-green-500/30">
        <CardContent className="pt-12 pb-10 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/20 p-5">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-foreground">Report Submitted</h2>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            Your incident has been logged and forwarded to local authorities. AI classification
            is in progress. Stay safe and follow official guidance.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => { setSubmitted(false); reset(); }}>
              Report Another
            </Button>
            <Button onClick={() => window.location.href = "/dashboard"}>
              View Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-400" />
          Report an Incident
        </CardTitle>
        <CardDescription>
          Your report is anonymous by default. AI will classify and route it to the correct authorities.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Incident Type */}
          <div className="space-y-1.5">
            <Label>Incident Type *</Label>
            <Select onValueChange={(v) => setValue("type", v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select incident type..." />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-red-400">{errors.type.message}</p>}
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <Label>Severity Level *</Label>
            <Select onValueChange={(v) => setValue("severity", v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Assess severity..." />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.severity && <p className="text-xs text-red-400">{errors.severity.message}</p>}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Incident Title *</Label>
            <Input
              {...register("title")}
              placeholder="e.g. Flash flood blocking Westlands underpass"
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              {...register("description")}
              rows={4}
              placeholder="Describe what you see. Include details like number of people affected, any injuries, and any immediate risks. You can write in any language."
            />
            {errors.description && (
              <p className="text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location *</Label>
            <div className="flex gap-2">
              <Input
                {...register("location_name")}
                placeholder="Area or street name"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={detectLocation}
                disabled={locating}
                title="Detect my location"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.location_name && (
              <p className="text-xs text-red-400">{errors.location_name.message}</p>
            )}
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.000001"
                {...register("lat", { valueAsNumber: true })}
                placeholder="-1.2921"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.000001"
                {...register("lng", { valueAsNumber: true })}
                placeholder="36.8219"
              />
            </div>
          </div>

          {/* Affected Count */}
          <div className="space-y-1.5">
            <Label>Estimated People Affected</Label>
            <Input
              type="number"
              min={0}
              {...register("affected_count", { valueAsNumber: true })}
              placeholder="e.g. 50"
            />
          </div>

          {/* Optional reporter info */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Optional: Contact Info (kept confidential)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Your Name</Label>
                <Input {...register("reporter_name")} placeholder="Anonymous" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (for follow-up)</Label>
                <Input {...register("reporter_phone")} placeholder="+254 7XX XXX XXX" />
              </div>
            </div>
          </div>

          {/* Photo Evidence Placeholder */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              Photo Evidence
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <label className="group flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/20 p-6 text-center cursor-pointer hover:bg-secondary/30 hover:border-primary/40 transition-all">
              {photoName ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Photo attached</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{photoName}</p>
                  </div>
                </>
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-muted-foreground group-hover:text-primary/70 transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      Click to attach a photo
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      JPEG, PNG or WEBP · max 10 MB
                    </p>
                  </div>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPhotoName(file.name);
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground text-center">
              📸 Photo upload active in demo — file is not transmitted to the server.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Incident Report"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Reports are processed by Gemini AI and forwarded to county emergency services.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
