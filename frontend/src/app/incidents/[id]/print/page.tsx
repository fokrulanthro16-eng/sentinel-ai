"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Download, X, Loader2, AlertCircle } from "lucide-react";
import type { Incident } from "@/types";
import { INCIDENT_ICONS, SEVERITY_COLORS, formatRelativeTime } from "@/lib/utils";
import { downloadSingleIncidentPDF } from "@/lib/export";

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  high:     "bg-orange-50 border-orange-200",
  medium:   "bg-yellow-50 border-yellow-200",
  low:      "bg-green-50 border-green-200",
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-red-700",
  high:     "text-orange-700",
  medium:   "text-yellow-700",
  low:      "text-green-700",
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

export default function IncidentPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${apiUrl}/api/incidents/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setIncident)
      .catch(() => setError(true));
  }, [id, apiUrl]);

  const handlePrint = () => window.print();

  const handlePDF = async () => {
    if (!incident) return;
    setExporting(true);
    await downloadSingleIncidentPDF(incident).catch(() => {});
    setExporting(false);
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p>Incident not found or server offline.</p>
        <button onClick={() => window.close()} className="text-sm text-blue-600 hover:underline">
          Close
        </button>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const sevBg   = SEVERITY_BG[incident.severity]   ?? "bg-gray-50 border-gray-200";
  const sevText = SEVERITY_TEXT[incident.severity]  ?? "text-gray-700";

  return (
    <>
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-6 py-3 shadow-sm">
        <span className="mr-auto font-semibold text-gray-700">Incident Report #{incident.id}</span>
        <button
          onClick={handlePDF}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export PDF
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Print-optimised content */}
      <div className="mx-auto max-w-2xl px-8 py-8 print:max-w-none print:px-6 print:py-4">
        {/* Severity band */}
        <div className={`mb-6 rounded-lg border-2 p-4 ${sevBg}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{INCIDENT_ICONS[incident.type] ?? "📍"}</span>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest ${sevText}`}>
                {incident.severity} SEVERITY
              </p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{incident.title}</h1>
            </div>
            {incident.verified && (
              <span className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                ✓ Verified
              </span>
            )}
          </div>
        </div>

        {/* Header branding */}
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <p className="text-lg font-black text-gray-900">SENTINEL AI</p>
            <p className="text-xs text-gray-400">Community ActionGrid — Official Incident Report</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>ID: <span className="font-mono text-gray-600">{incident.id}</span></p>
            <p>{new Date(incident.timestamp).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 print:gap-4">
          {/* Left column */}
          <dl className="space-y-0">
            <Field label="Incident Type" value={incident.type.replace(/_/g, " ")} />
            <Field label="Status"        value={incident.status.replace(/_/g, " ")} />
            <Field label="Location"      value={incident.location_name} />
            <Field label="Coordinates"   value={`${incident.lat.toFixed(5)}, ${incident.lng.toFixed(5)}`} />
            <Field label="People Affected" value={incident.affected_count?.toLocaleString()} />
          </dl>

          {/* Right column */}
          <dl className="space-y-0">
            <Field label="Reporter"      value={incident.reporter_name ?? "Anonymous"} />
            <Field label="Reporter Phone" value={incident.reporter_phone} />
            <Field label="AI Category"   value={incident.ai_category} />
            <Field
              label="AI Confidence"
              value={incident.ai_confidence != null ? `${Math.round(incident.ai_confidence * 100)}%` : undefined}
            />
            <Field label="Reported"      value={formatRelativeTime(incident.timestamp)} />
          </dl>
        </div>

        {incident.description && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Description</p>
            <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{incident.description}</p>
          </div>
        )}

        {incident.admin_notes && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-500">Admin Notes</p>
            <p className="text-sm text-blue-800">{incident.admin_notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t pt-4 text-center text-xs text-gray-400">
          <p>
            Generated by Sentinel AI — Community ActionGrid · {new Date().toLocaleString()}
          </p>
          <p className="mt-1">This document is for official emergency management use only.</p>
        </div>
      </div>
    </>
  );
}
