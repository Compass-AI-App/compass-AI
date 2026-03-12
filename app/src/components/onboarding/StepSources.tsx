import { useState } from "react";
import {
  Link2,
  Check,
  Loader2,
  ArrowRight,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";

interface SourceDef {
  type: string;
  label: string;
  description: string;
  supportsLive: boolean;
  providerId?: string;
}

const ALL_SOURCES: SourceDef[] = [
  { type: "github", label: "Code (GitHub)", description: "Repository directory or GitHub API", supportsLive: true, providerId: "github" },
  { type: "docs", label: "Docs", description: "Strategy docs, PRDs, roadmaps", supportsLive: false },
  { type: "analytics", label: "Analytics", description: "CSV metrics data", supportsLive: false },
  { type: "interviews", label: "Interviews", description: "User research notes", supportsLive: false },
  { type: "support", label: "Support", description: "Tickets and feedback", supportsLive: false },
  { type: "jira", label: "Jira", description: "Issues and sprints", supportsLive: true, providerId: "atlassian" },
  { type: "slack", label: "Slack", description: "Channel messages", supportsLive: true, providerId: "slack" },
  { type: "linear", label: "Linear", description: "Issues and projects", supportsLive: true, providerId: "linear" },
];

interface StepSourcesProps {
  recommendedSources: string[];
  workspacePath: string;
  onNext: (sources: { type: string; path: string; name: string }[]) => void;
  onBack: () => void;
}

export default function StepSources({ recommendedSources, workspacePath, onNext, onBack }: StepSourcesProps) {
  const [connected, setConnected] = useState<string[]>([]);
  const [pendingSources, setPendingSources] = useState<{ type: string; path: string; name: string }[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Show recommended sources first, then the rest
  const recommended = ALL_SOURCES.filter((s) => recommendedSources.includes(s.type));
  const other = ALL_SOURCES.filter((s) => !recommendedSources.includes(s.type));
  const orderedSources = [...recommended, ...other];

  async function handleConnect(source: SourceDef) {
    if (connected.includes(source.type)) return;
    setConnecting(source.type);
    setError("");

    try {
      // For live sources, try OAuth first
      if (source.supportsLive && source.providerId) {
        try {
          const providers = await window.compass.providers?.list();
          const provider = providers?.find((p: { id: string }) => p.id === source.providerId);
          if (provider) {
            const result = await window.compass.oauth.start(provider);
            await window.compass.credentials.store(source.providerId!, {
              provider: source.providerId,
              method: "oauth",
              access_token: result.access_token,
              refresh_token: result.refresh_token || "",
              expires_at: result.expires_at || 0,
              scopes: result.scopes || [],
            });
            // Inject into engine
            await window.compass.engine.call("/credentials/inject", {
              provider: source.providerId,
              access_token: result.access_token,
              refresh_token: result.refresh_token || "",
              expires_at: result.expires_at || "",
            });

            const name = `${source.type}:${source.providerId}-live`;
            setPendingSources((prev) => [...prev, { type: source.type, path: "", name }]);
            setConnected((prev) => [...prev, source.type]);
            setConnecting(null);
            return;
          }
        } catch {
          // OAuth not available, fall back to file picker
        }
      }

      // File-based fallback
      const selectedPath = await window.compass?.app.selectDirectory();
      if (selectedPath) {
        const name = `${source.type}:${selectedPath.split("/").pop()}`;
        setPendingSources((prev) => [...prev, { type: source.type, path: selectedPath, name }]);
        setConnected((prev) => [...prev, source.type]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <Link2 className="w-12 h-12 text-compass-accent mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-compass-text mb-2">
          Connect Sources
        </h2>
        <p className="text-sm text-neutral-400">
          Connect at least one source. You can always add more later.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-2 mb-6">
        {orderedSources.map((source) => {
          const isConnected = connected.includes(source.type);
          const isRecommended = recommendedSources.includes(source.type);
          const isConnecting = connecting === source.type;

          return (
            <button
              key={source.type}
              onClick={() => handleConnect(source)}
              disabled={isConnected || connecting !== null}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors",
                isConnected
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-compass-border hover:border-compass-accent bg-compass-card"
              )}
            >
              <FolderOpen className={clsx("w-4 h-4 shrink-0", isConnected ? "text-green-400" : "text-compass-muted")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={clsx("text-sm font-medium", isConnected ? "text-green-400" : "text-compass-text")}>
                    {source.label}
                  </p>
                  {isRecommended && !isConnected && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-compass-accent/10 text-compass-accent">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">{source.description}</p>
              </div>
              {isConnected ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : isConnecting ? (
                <Loader2 className="w-4 h-4 text-compass-muted animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 text-compass-muted" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="text-sm text-compass-muted hover:text-compass-text"
        >
          Back
        </button>
        <button
          onClick={() => onNext(pendingSources)}
          disabled={connected.length === 0}
          className={clsx(
            "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
            connected.length > 0
              ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
              : "bg-compass-card text-neutral-600 cursor-not-allowed"
          )}
        >
          Launch Compass
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
