import { useEffect, useState } from "react";
import {
  Github,
  Globe,
  MessageSquare,
  Trello,
  FileText,
  BookOpen,
  Headphones,
  Link,
  Unlink,
  Loader2,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { useCredentialsStore } from "../../stores/credentials";

/** Provider display metadata. */
const PROVIDER_META: Record<
  string,
  { name: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }
> = {
  github: {
    name: "GitHub",
    icon: Github,
    color: "text-white",
    description: "Repos, issues, pull requests",
  },
  google: {
    name: "Google",
    icon: Globe,
    color: "text-blue-400",
    description: "Google Drive, Docs",
  },
  slack: {
    name: "Slack",
    icon: MessageSquare,
    color: "text-purple-400",
    description: "Channels, messages, search",
  },
  atlassian: {
    name: "Atlassian",
    icon: Trello,
    color: "text-blue-500",
    description: "Jira issues, Confluence pages",
  },
  linear: {
    name: "Linear",
    icon: FileText,
    color: "text-indigo-400",
    description: "Issues, projects, cycles",
  },
  notion: {
    name: "Notion",
    icon: BookOpen,
    color: "text-white",
    description: "Pages, databases",
  },
  zendesk: {
    name: "Zendesk",
    icon: Headphones,
    color: "text-green-400",
    description: "Tickets, customer feedback",
  },
};

const ALL_PROVIDERS = Object.keys(PROVIDER_META);

/** API key providers that show a key input instead of OAuth button. */
const API_KEY_PROVIDERS = new Set(["zendesk"]);

export default function ConnectedAccounts() {
  const { credentials, loading, error, fetchCredentials, connectOAuth, connectApiKey, disconnect } =
    useCredentialsStore();
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [metadataInputs, setMetadataInputs] = useState<Record<string, string>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const credMap = new Map(credentials.map((c) => [c.provider, c]));

  async function handleConnect(providerId: string) {
    setConnectingId(providerId);
    try {
      if (API_KEY_PROVIDERS.has(providerId)) {
        const key = apiKeyInputs[providerId];
        if (!key) return;
        const metadata = metadataInputs[providerId]
          ? { subdomain: metadataInputs[providerId] }
          : undefined;
        await connectApiKey(providerId, key, metadata);
        setApiKeyInputs((p) => ({ ...p, [providerId]: "" }));
        setMetadataInputs((p) => ({ ...p, [providerId]: "" }));
      } else {
        await connectOAuth(providerId);
      }
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {ALL_PROVIDERS.map((id) => {
        const meta = PROVIDER_META[id];
        const cred = credMap.get(id);
        const isConnected = cred?.status === "connected";
        const isExpired = cred?.status === "expired";
        const isConnecting = connectingId === id;
        const Icon = meta.icon;

        return (
          <div
            key={id}
            className="flex items-center gap-3 p-3 rounded-lg bg-compass-card border border-compass-border"
          >
            <Icon className={clsx("w-5 h-5 shrink-0", meta.color)} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-compass-text">{meta.name}</span>
                {isConnected && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400">
                    Connected
                  </span>
                )}
                {isExpired && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-400">
                    Expired
                  </span>
                )}
              </div>
              <p className="text-xs text-compass-muted">{meta.description}</p>
            </div>

            {/* API Key input for key-based providers */}
            {!isConnected && API_KEY_PROVIDERS.has(id) && (
              <div className="flex items-center gap-2">
                {id === "zendesk" && (
                  <input
                    type="text"
                    value={metadataInputs[id] || ""}
                    onChange={(e) =>
                      setMetadataInputs((p) => ({ ...p, [id]: e.target.value }))
                    }
                    placeholder="subdomain"
                    className="w-24 px-2 py-1.5 rounded bg-compass-bg border border-compass-border text-xs text-compass-text placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent"
                  />
                )}
                <input
                  type="password"
                  value={apiKeyInputs[id] || ""}
                  onChange={(e) =>
                    setApiKeyInputs((p) => ({ ...p, [id]: e.target.value }))
                  }
                  placeholder="API key"
                  className="w-32 px-2 py-1.5 rounded bg-compass-bg border border-compass-border text-xs text-compass-text placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent font-mono"
                />
              </div>
            )}

            {/* Connect / Disconnect button */}
            {isConnected || isExpired ? (
              <button
                onClick={() => disconnect(id)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
              >
                <Unlink className="w-3 h-3" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnect(id)}
                disabled={isConnecting || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-compass-accent hover:bg-compass-accent/10 border border-compass-accent/20 transition-colors disabled:opacity-50"
              >
                {isConnecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : API_KEY_PROVIDERS.has(id) ? (
                  <KeyRound className="w-3 h-3" />
                ) : (
                  <Link className="w-3 h-3" />
                )}
                {API_KEY_PROVIDERS.has(id) ? "Save Key" : "Connect"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
