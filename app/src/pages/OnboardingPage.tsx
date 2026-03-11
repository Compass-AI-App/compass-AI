import { useState } from "react";
import {
  Compass,
  ArrowRight,
  FolderOpen,
  Key,
  Link2,
  Check,
  Loader2,
  Shield,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceManager } from "../stores/workspaceManager";
import { useNavigate } from "react-router-dom";

type Step = 1 | 2 | 3 | 4;

const ONBOARDING_KEY = "compass-onboarding-complete";

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_KEY);
}

function completeOnboarding(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

const SOURCE_TYPES = [
  { type: "github", label: "Code (GitHub)", description: "Repository directory" },
  { type: "docs", label: "Docs", description: "Strategy docs, PRDs, roadmaps" },
  { type: "analytics", label: "Analytics", description: "CSV metrics data" },
  { type: "interviews", label: "Interviews", description: "User research notes" },
  { type: "support", label: "Support", description: "Tickets and feedback" },
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [connectedSources, setConnectedSources] = useState<string[]>([]);
  const [pendingSources, setPendingSources] = useState<{ type: string; path: string; name: string }[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false);

  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const setSettingsApiKey = useSettingsStore((s) => s.setApiKey);
  const setSettingsModel = useSettingsStore((s) => s.setModel);
  const setProvider = useSettingsStore((s) => s.setProvider);
  const addWorkspaceEntry = useWorkspaceManager((s) => s.addWorkspace);
  const navigate = useNavigate();

  async function handlePickFolder() {
    const selected = await window.compass?.app.selectDirectory();
    if (selected) setWorkspacePath(selected);
  }

  async function handleConnectSource(sourceType: string) {
    if (connectedSources.includes(sourceType) || !workspacePath) return;
    setConnecting(true);
    setError(null);
    try {
      const selectedPath = await window.compass?.app.selectDirectory();
      if (selectedPath) {
        const name = `${sourceType}:${selectedPath.split("/").pop()}`;
        setPendingSources((prev) => [...prev, { type: sourceType, path: selectedPath, name }]);
        setConnectedSources((prev) => [...prev, sourceType]);
      }
    } catch (err) {
      console.error("Select directory failed:", err);
      setError("Failed to select directory. Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleFinish() {
    if (!workspacePath) return;
    setError(null);

    // 1. Save API key and settings first (so engine can use them)
    setProvider("byok");
    if (apiKey) setSettingsApiKey(apiKey);
    setSettingsModel(model);

    // 2. Init workspace
    try {
      await window.compass?.engine.call("/init", {
        workspace_path: workspacePath,
        product_name: productName,
        product_description: productDesc,
      });
    } catch {
      // may already be initialized
    }

    // 3. Connect all pending sources (workspace is now initialized)
    for (const source of pendingSources) {
      try {
        await window.compass?.engine.call("/connect", {
          workspace_path: workspacePath,
          source_type: source.type,
          name: source.name,
          path: source.path,
        });
      } catch (err) {
        console.error(`Failed to connect source ${source.name}:`, err);
      }
    }

    // 4. Register workspace
    setWorkspace(workspacePath, productName, productDesc);
    await addWorkspaceEntry({
      name: productName,
      description: productDesc,
      path: workspacePath,
    });

    // 5. Auto-trigger ingestion in background (non-blocking)
    if (pendingSources.length > 0) {
      useWorkspaceStore.getState().triggerIngestion(workspacePath);
    }

    completeOnboarding();
    navigate("/workspace");
  }

  return (
    <div className="min-h-screen bg-compass-bg flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={clsx(
                "w-2.5 h-2.5 rounded-full transition-colors",
                s <= step ? "bg-compass-accent" : "bg-compass-border"
              )}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center">
            <Compass className="w-16 h-16 text-compass-accent mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-compass-text mb-3">
              Welcome to Compass
            </h1>
            <p className="text-neutral-400 mb-2">
              The AI-native product discovery tool.
            </p>
            <p className="text-sm text-neutral-500 mb-8 max-w-sm mx-auto">
              Compass connects to your product's sources of truth — code, docs,
              data, and judgment — to surface evidence-grounded opportunities.
            </p>
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-compass-accent hover:bg-compass-accent-hover text-white font-medium transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Create Product */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <FolderOpen className="w-6 h-6 text-compass-accent" />
              <h2 className="text-xl font-semibold text-compass-text">
                Your Product
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Product name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Acme Dashboard"
                  className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:border-compass-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Short description
                </label>
                <textarea
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  placeholder="What does this product do?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:border-compass-accent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Workspace folder
                </label>
                <button
                  onClick={handlePickFolder}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-sm hover:border-compass-accent transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-compass-muted" />
                  <span className={workspacePath ? "text-compass-text" : "text-neutral-600"}>
                    {workspacePath || "Select a folder..."}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-compass-muted hover:text-compass-text"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!productName || !workspacePath}
                className={clsx(
                  "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                  productName && workspacePath
                    ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
                    : "bg-compass-card text-neutral-600 cursor-not-allowed"
                )}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: AI Setup */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Key className="w-6 h-6 text-compass-accent" />
              <h2 className="text-xl font-semibold text-compass-text">
                AI Setup
              </h2>
            </div>

            <p className="text-sm text-neutral-400 mb-4">
              Compass uses Claude to analyze your product evidence. Enter your Anthropic API key to get started.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:border-compass-accent font-mono"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Get one at{" "}
                  <span className="text-compass-accent">console.anthropic.com</span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm focus:outline-none focus:border-compass-accent"
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recommended)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (faster)</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
                </select>
              </div>

              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-compass-card/50 border border-compass-border/50">
                <Shield className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <p className="text-xs text-neutral-400">
                  Your key is encrypted with your OS keychain and stored locally.
                  Sent directly to the Anthropic API — never to Compass servers.
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-compass-muted hover:text-compass-text"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!apiKey}
                className={clsx(
                  "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                  apiKey
                    ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
                    : "bg-compass-card text-neutral-600 cursor-not-allowed"
                )}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Connect Sources */}
        {step === 4 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Link2 className="w-6 h-6 text-compass-accent" />
              <h2 className="text-xl font-semibold text-compass-text">
                Connect Sources
              </h2>
            </div>
            <p className="text-sm text-neutral-400 mb-4">
              Connect at least one source of truth. You can add more later.
            </p>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              {SOURCE_TYPES.map((src) => {
                const connected = connectedSources.includes(src.type);
                return (
                  <button
                    key={src.type}
                    onClick={() => handleConnectSource(src.type)}
                    disabled={connected || connecting}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors",
                      connected
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-compass-border hover:border-compass-accent bg-compass-card"
                    )}
                  >
                    <div className="flex-1">
                      <p className={clsx("text-sm font-medium", connected ? "text-green-400" : "text-compass-text")}>
                        {src.label}
                      </p>
                      <p className="text-xs text-neutral-500">{src.description}</p>
                    </div>
                    {connected ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : connecting ? (
                      <Loader2 className="w-4 h-4 text-compass-muted animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-compass-muted" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(3)}
                className="text-sm text-compass-muted hover:text-compass-text"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={connectedSources.length === 0}
                className={clsx(
                  "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                  connectedSources.length > 0
                    ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
                    : "bg-compass-card text-neutral-600 cursor-not-allowed"
                )}
              >
                Launch Compass
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
