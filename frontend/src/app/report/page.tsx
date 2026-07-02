import IncidentForm from "@/components/report/IncidentForm";
import { AlertTriangle, Globe2, Bot, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: Bot, text: "AI classifies your report instantly" },
  { icon: Globe2, text: "Write in any language" },
  { icon: ShieldCheck, text: "Anonymous submissions accepted" },
  { icon: AlertTriangle, text: "Critical reports prioritised automatically" },
];

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid lg:grid-cols-5 gap-10">
        {/* Left info column */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Report an Incident</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Help your community by reporting what you see. Your report will be processed by
              Gemini AI and forwarded to the relevant emergency services.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border">
                  <Icon className="h-4 w-4 text-blue-400" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-400">Emergency Numbers</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>🚒 Fire: <span className="text-foreground font-mono">999</span></p>
              <p>🚑 Ambulance: <span className="text-foreground font-mono">999</span></p>
              <p>🚔 Police: <span className="text-foreground font-mono">999</span></p>
              <p>🆘 NDMA Hotline: <span className="text-foreground font-mono">0800 720 000</span></p>
              <p>🏥 KNH Emergency: <span className="text-foreground font-mono">+254 20 2726300</span></p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Privacy Notice</p>
            <p>
              Personal information (name, phone) is optional and used only for follow-up by
              emergency services. Reports may be shared with county authorities and NGO partners
              operating in affected areas.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          <IncidentForm />
        </div>
      </div>
    </div>
  );
}
