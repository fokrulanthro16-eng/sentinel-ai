import type { Incident } from "@/types";
import { INCIDENT_ICONS, formatRelativeTime } from "@/lib/utils";

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function incidentsToRows(incidents: Incident[]): Record<string, unknown>[] {
  return incidents.map((i) => ({
    ID:               i.id,
    Type:             i.type,
    Title:            i.title,
    Description:      i.description ?? "",
    Severity:         i.severity,
    Status:           i.status,
    Location:         i.location_name,
    Latitude:         i.lat,
    Longitude:        i.lng,
    "Affected Count": i.affected_count ?? 0,
    Reporter:         i.reporter_name ?? "Anonymous",
    "AI Category":    i.ai_category ?? "",
    "AI Confidence":  i.ai_confidence != null ? `${Math.round(i.ai_confidence * 100)}%` : "",
    Verified:         i.verified ? "Yes" : "No",
    "Admin Notes":    i.admin_notes ?? "",
    Timestamp:        i.timestamp,
  }));
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export async function downloadIncidentsPDF(
  incidents: Incident[],
  title = "Sentinel AI — Incident Report"
): Promise<void> {
  // Dynamic import keeps jspdf out of the initial bundle
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFillColor(15, 17, 26);
  doc.rect(0, 0, 297, 28, "F");
  doc.setTextColor(239, 68, 68);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 13);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}  ·  ${incidents.length} incidents`, 14, 21);

  autoTable(doc, {
    startY: 32,
    head: [["#", "Type", "Title", "Severity", "Status", "Location", "Affected", "AI Category", "Time"]],
    body: incidents.map((i, idx) => [
      idx + 1,
      (INCIDENT_ICONS[i.type] ?? "?") + " " + i.type.replace(/_/g, " "),
      i.title,
      i.severity.toUpperCase(),
      i.status.replace(/_/g, " "),
      i.location_name,
      i.affected_count?.toLocaleString() ?? "—",
      i.ai_category ?? "—",
      formatRelativeTime(i.timestamp),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 55 },
      5: { cellWidth: 40 },
    },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Sentinel AI — Community ActionGrid  ·  Page ${data.pageNumber}`,
        14,
        doc.internal.pageSize.height - 8
      );
    },
  });

  doc.save(`sentinel-incidents-${Date.now()}.pdf`);
}

export async function downloadSingleIncidentPDF(incident: Incident): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const sev = incident.severity.toUpperCase();
  const sevColor: Record<string, [number, number, number]> = {
    CRITICAL: [239, 68, 68],
    HIGH:     [249, 115, 22],
    MEDIUM:   [234, 179, 8],
    LOW:      [34, 197, 94],
  };

  // Cover band
  const [r, g, b] = sevColor[sev] ?? [59, 130, 246];
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 6, "F");

  // Logo row
  doc.setFillColor(15, 17, 26);
  doc.rect(0, 6, 210, 26, "F");
  doc.setTextColor(239, 68, 68);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SENTINEL AI", 14, 19);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Community ActionGrid — Incident Report", 14, 26);

  let y = 42;
  const field = (label: string, value: string, mono = false) => {
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), 14, y);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", mono ? "normal" : "bold");
    const lines = doc.splitTextToSize(value, 175);
    doc.text(lines, 14, y + 5);
    y += 5 + lines.length * 5 + 5;
  };

  const divider = () => {
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);
    y += 6;
  };

  field("Incident ID", incident.id, true);
  field("Title", incident.title);
  divider();
  field("Type", `${INCIDENT_ICONS[incident.type] ?? ""} ${incident.type.replace(/_/g, " ")}`);
  field("Severity", sev);
  field("Status", incident.status.replace(/_/g, " ").toUpperCase());
  field("Location", `${incident.location_name}  (${incident.lat.toFixed(5)}, ${incident.lng.toFixed(5)})`);
  if (incident.affected_count) field("Affected People", incident.affected_count.toLocaleString());
  divider();
  if (incident.description) field("Description", incident.description);
  if (incident.ai_category) {
    field(
      "AI Classification",
      `${incident.ai_category} (${incident.ai_confidence != null ? Math.round(incident.ai_confidence * 100) : "—"}% confidence)`
    );
  }
  if (incident.admin_notes) field("Admin Notes", incident.admin_notes);
  divider();
  field("Reporter", incident.reporter_name ?? "Anonymous");
  if (incident.reporter_phone) field("Reporter Phone", incident.reporter_phone);
  field("Reported At", new Date(incident.timestamp).toLocaleString());
  field("Verified", incident.verified ? "YES — Verified by administrator" : "Not yet verified");

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Sentinel AI — Community ActionGrid  ·  Generated ${new Date().toLocaleString()}`,
    14,
    doc.internal.pageSize.height - 10
  );

  doc.save(`incident-${incident.id}.pdf`);
}
