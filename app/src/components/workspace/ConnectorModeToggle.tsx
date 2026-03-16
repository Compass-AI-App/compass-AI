import { useState, useEffect } from "react";
import { Wifi, FolderOpen, Link, Loader2, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { useCredentialsStore } from "../../stores/credentials";

/** Maps source connector types to their OAuth provider IDs. */
const SOURCE_TO_PROVIDER: Record<string, string> = {
  code: "github",
  github: "github",
  docs: "google",
  google_docs: "google",
  jira: "atlassian",
  confluence: "atlassian",
  slack: "slack",
  linear: "linear",
  notion: "notion",
  zendesk: "zendesk",
};

/** Human-readable provider names. */
const PROVIDER_NAMES: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  atlassian: "Atlassian",
  slack: "Slack",
  linear: "Linear",
  notion: "Notion",
  zendesk: "Zendesk",
};

interface ConnectorModeToggleProps {
  sourceType: string;
  mode: "live" | "file";
  onModeChange: (mode: "live" | "file") => void;
  lastSynced?: string | null;
  itemCount?: number;
}

export default function ConnectorModeToggle({
  sourceType,
  mode,
  onModeChange,
  lastSynced,
  itemCount,
}: ConnectorModeToggleProps) {
  const { credentials, fetchCredentials, connectOAuth } = useCredentialsStore();
  const [connecting, setConnecting] = useState(false);

  const providerId = SOURCE_TO_PROVIDER[sourceType];
  if (!providerId) return null; // No live API available for this source type

  const providerName = PROVIDER_NAMES[providerId] || providerId;
  const credential = credentials.find((c) => c.provider === providerId);
  const isConnected = credential?.status === "connected";

  useEffect(() => {
    fetchCredentials();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectOAuth(providerId);
      onModeChange("live");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-compass-bg border border-compass-border w-fit">
        <button
          onClick={() => onModeChange("file")}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors",
            mode === "file"
              ? "bg-compass-card text-compass-text shadow-sm"
              : "text-compass-muted hover:text-compass-text"
          )}
        >
          <FolderOpen className="w-3 h-3" />
          File Import
        </button>
        <button
          onClick={() => {
            if (isConnected) {
              onModeChange("live");
            }
          }}
          disabled={!isConnected}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors",
            mode === "live"
              ? "bg-compass-accent/10 text-compass-accent shadow-sm"
              : isConnected
                ? "text-compass-muted hover:text-compass-text"
                : "text-neutral-600 cursor-not-allowed"
          )}
        >
          <Wifi className="w-3 h-3" />
          Live API
        </button>
      </div>

      {/* Connection status / connect button */}
      {mode === "live" || !isConnected ? (
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {providerName} connected
              </span>
              {lastSynced && (
                <span className="text-compass-muted">
                  Last synced: {lastSynced}
                </span>
              )}
              {typeof itemCount === "number" && (
                <span className="text-compass-muted">
                  {itemCount} items
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-compass-accent hover:bg-compass-accent/10 border border-compass-accent/20 transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Link className="w-3 h-3" />
              )}
              Connect {providerName}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
