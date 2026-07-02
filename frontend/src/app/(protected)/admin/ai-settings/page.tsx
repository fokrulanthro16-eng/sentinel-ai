"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Brain, Save, FlaskConical, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, ArrowLeft, Cpu, Cloud, Zap, Info, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { fetchAISettings, saveAISettings, testAIConnection } from "@/lib/api";
import type { AIProvider, AISettings, AITestResult } from "@/types";

// ── Provider metadata ─────────────────────────────────────────────────────────

const PROVIDER_META: Record<
  AIProvider,
  {
    label: string;
    description: string;
    icon: "local" | "cloud";
    needsKey: boolean;
    needsUrl: boolean;
    keyPlaceholder: string;
    defaultModel: string;
    modelHint: string;
    urlPlaceholder: string;
  }
> = {
  mock: {
    label: "Mock AI",
    description: "Built-in demo mode — no external calls, always available.",
    icon: "local",
    needsKey: false,
    needsUrl: false,
    keyPlaceholder: "",
    defaultModel: "",
    modelHint: "",
    urlPlaceholder: "",
  },
  gemini: {
    label: "Google Gemini",
    description: "Google's Gemini models via AI Studio.",
    icon: "cloud",
    needsKey: true,
    needsUrl: false,
    keyPlaceholder: "AIza...",
    defaultModel: "gemini-1.5-flash",
    modelHint: "gemini-1.5-flash · gemini-1.5-pro · gemini-2.0-flash",
    urlPlaceholder: "",
  },
  openai: {
    label: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, and other OpenAI models.",
    icon: "cloud",
    needsKey: true,
    needsUrl: false,
    keyPlaceholder: "sk-...",
    defaultModel: "gpt-4o-mini",
    modelHint: "gpt-4o-mini · gpt-4o · gpt-4-turbo",
    urlPlaceholder: "",
  },
  anthropic: {
    label: "Anthropic Claude",
    description: "Claude Haiku, Sonnet, and Opus models.",
    icon: "cloud",
    needsKey: true,
    needsUrl: false,
    keyPlaceholder: "sk-ant-...",
    defaultModel: "claude-haiku-4-5-20251001",
    modelHint: "claude-haiku-4-5-20251001 · claude-sonnet-4-5 · claude-opus-4-8",
    urlPlaceholder: "",
  },
  ollama: {
    label: "Ollama Local AI",
    description: "Run models locally with Ollama (no API key required).",
    icon: "local",
    needsKey: false,
    needsUrl: true,
    keyPlaceholder: "",
    defaultModel: "llama3",
    modelHint: "llama3 · mistral · codellama · phi3",
    urlPlaceholder: "http://localhost:11434",
  },
  lmstudio: {
    label: "LM Studio",
    description: "Run any GGUF model locally via LM Studio's server.",
    icon: "local",
    needsKey: false,
    needsUrl: true,
    keyPlaceholder: "",
    defaultModel: "local-model",
    modelHint: "Use the model name shown in LM Studio",
    urlPlaceholder: "http://localhost:1234/v1",
  },
};

const PROVIDER_BADGE: Record<AIProvider, string> = {
  mock:      "bg-secondary text-muted-foreground border-border",
  gemini:    "bg-blue-500/20 text-blue-400 border-blue-500/30",
  openai:    "bg-green-500/20 text-green-400 border-green-500/30",
  anthropic: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  ollama:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  lmstudio:  "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AISettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [provider, setProvider] = useState<AIProvider>("mock");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Operation state
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const [dirty, setDirty] = useState(false);

  // Admin guard
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/user-dashboard");
    }
  }, [status, session, router]);

  // Load current settings
  useEffect(() => {
    fetchAISettings()
      .then((s) => {
        setSettings(s);
        setProvider(s.provider);
        setModel(s.model);
        setBaseUrl(s.base_url);
        // api_key is never pre-filled — user must re-enter to change
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const meta = PROVIDER_META[provider];

  const markDirty = () => {
    setDirty(true);
    setTestResult(null);
    setSaveError("");
  };

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setModel(PROVIDER_META[p].defaultModel);
    setBaseUrl(PROVIDER_META[p].urlPlaceholder);
    setApiKey("");
    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const saved = await saveAISettings({ provider, model, api_key: apiKey, base_url: baseUrl });
      setSettings(saved);
      setApiKey(""); // clear after save
      setDirty(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    // Save first so test uses the new settings
    if (dirty) await handleSave();
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAIConnection();
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        provider,
        model,
        latency_ms: 0,
        error: "Request to backend failed",
      });
    } finally {
      setTesting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Admin Panel
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-500/40">
          <Brain className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">AI Provider Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure which AI backend powers Sentinel AI features.
          </p>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <XCircle className="h-4 w-4 shrink-0" />
          Could not load current settings. Backend may be offline.
        </div>
      )}

      {/* Current status banner */}
      {settings && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
          <span className="text-sm text-muted-foreground">Active provider</span>
          <div className="flex items-center gap-2">
            {PROVIDER_META[settings.provider].icon === "local" ? (
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PROVIDER_BADGE[settings.provider]}`}
            >
              {PROVIDER_META[settings.provider].label}
            </span>
            {settings.model && (
              <span className="text-xs text-muted-foreground font-mono">{settings.model}</span>
            )}
          </div>
        </div>
      )}

      {/* Settings form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-yellow-400" />
            Provider Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Provider select */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              AI Provider
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_META) as AIProvider[]).map((p) => {
                const m = PROVIDER_META[p];
                const active = provider === p;
                return (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all ${
                      active
                        ? `${PROVIDER_BADGE[p]} ring-1 ring-current`
                        : "border-border bg-secondary/20 text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {m.icon === "local" ? (
                        <Cpu className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Cloud className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="text-xs font-semibold">{m.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {meta.description && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Info className="h-3 w-3 shrink-0" />
                {meta.description}
              </p>
            )}
          </div>

          {/* Model name — hidden for mock */}
          {provider !== "mock" && (
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs text-muted-foreground uppercase tracking-wider">
                Model Name
              </Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => { setModel(e.target.value); markDirty(); }}
                placeholder={PROVIDER_META[provider].defaultModel}
                className="font-mono text-sm"
              />
              {meta.modelHint && (
                <p className="text-xs text-muted-foreground">{meta.modelHint}</p>
              )}
            </div>
          )}

          {/* API key — cloud providers only */}
          {meta.needsKey && (
            <div className="space-y-1.5">
              <Label htmlFor="api-key" className="text-xs text-muted-foreground uppercase tracking-wider">
                API Key
              </Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); markDirty(); }}
                  placeholder={
                    settings?.api_key_configured && settings.provider === provider
                      ? "••••••••••••  (key already set — leave blank to keep)"
                      : meta.keyPlaceholder
                  }
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sent directly to the backend — never stored in your browser or exposed in frontend code.
              </p>
            </div>
          )}

          {/* Base URL — local providers only */}
          {meta.needsUrl && (
            <div className="space-y-1.5">
              <Label htmlFor="base-url" className="text-xs text-muted-foreground uppercase tracking-wider">
                Base URL
              </Label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); markDirty(); }}
                placeholder={meta.urlPlaceholder}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {provider === "ollama"
                  ? "Default Ollama server. Start with: ollama serve"
                  : "LM Studio → Local Server → Start Server, copy the URL here."}
              </p>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                testResult.success
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              )}
              <div className="space-y-0.5">
                <p className={testResult.success ? "text-green-400" : "text-red-400"}>
                  {testResult.success ? "Connection successful" : "Connection failed"}
                  {testResult.latency_ms > 0 && (
                    <span className="ml-2 text-xs font-mono opacity-70">
                      {testResult.latency_ms}ms
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {testResult.message ?? testResult.error}
                </p>
              </div>
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || saving}
              className="flex-1 sm:flex-none"
            >
              {testing ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || testing || !dirty}
              className="flex-1 sm:flex-none"
            >
              {saving ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              Save Settings
            </Button>
            {!dirty && settings && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-400" />
                Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security note */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security</p>
        <ul className="space-y-1">
          {[
            "API keys are sent only to the backend — never stored in the browser.",
            "Keys are never returned by the GET /api/ai/settings endpoint.",
            "Settings persist in backend memory; restart reloads from .env.",
            "For permanent key storage, set the variable in the backend .env file.",
          ].map((note) => (
            <li key={note} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
              {note}
            </li>
          ))}
        </ul>
      </div>

      {/* Feature coverage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Features Using Selected Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "Risk Summary (SITREP)",
              "Incident Classification",
              "Multilingual Alert Translation",
              "Priority Action Recommendations",
              "Trust Engine Semantic Analysis",
              "Intelligence Analysis",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Brain className="h-3 w-3 text-blue-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
