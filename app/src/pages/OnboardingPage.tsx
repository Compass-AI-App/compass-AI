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
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useSettingsStore } from "../stores/settings";
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
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [connectedSources, setConnectedSources] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);

  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const setSettingsApiKey = useSettingsStore((s) => s.setApiKey);
  const setSettingsModel = useSettingsStore((s) => s.setModel);
  const setProvider = useSettingsStore((s) => s.setProvider);
  const navigate = useNavigate();

  async function handlePickFolder() {
    const selected = await window.compass?.app.selectDirectory();
    if (selected) setWorkspacePath(selected);
  }

  async function handleConnectSource(sourceType: string) {
    if (connectedSources.includes(sourceType) || !workspacePath) return;
    setConnecting(true);
    try {
      const path = await window.compass?.app.selectDirectory();
      if (path) {
        await window.compass?.engine.call("/connect", {
          workspace_path: workspacePath,
          source_type: sourceType === "analytics" ? "data" : sourceType === "interviews" || sourceType === "support" ? "judgment" : sourceType === "docs" ? "docs" : "code",
          connector: sourceType,
          config: { path },
          name: `${sourceType}:${path.split("/").pop()}`,
        });
        setConnectedSources((prev) => [...prev, sourceType]);
      }
    } catch (err) {
      console.error("Connect source failed:", err);
    } finally {
      setConnecting(false);
    }
  }

  async function handleFinish() {
    if (!workspacePath) return;

    // Init workspace
    try {
      await window.compass?.engine.call("/init", {
        workspace_path: workspacePath,
        product_name: productName,
        product_description: productDesc,
      });
    } catch {
      // may already be initialized
    }

    // Save settings
    setWorkspace(workspacePath, productName, productDesc);
    if (useOwnKey && apiKey) {
      setProvider("byok");
      setSettingsApiKey(apiKey);
    } else {
      setProvider("compass");
    }
    setSettingsModel(model);

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
              <Zap className="w-6 h-6 text-compass-accent" />
              <h2 className="text-xl font-semibold text-compass-text">
                AI Setup
              </h2>
            </div>

            {/* Default: Compass-provided */}
            <div className="rounded-lg border border-compass-accent/30 bg-compass-accent/5 p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Compass className="w-4 h-4 text-compass-accent" />
                <p className="text-sm font-medium text-compass-text">
                  Powered by Claude
                </p>
              </div>
              <p className="text-xs text-neutral-400">
                Compass includes AI out of the box. No setup needed — just start using it.
              </p>
            </div>

            {/* Model selector */}
            <div className="mb-4">
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

            {/* Optional: BYOK */}
            <button
              onClick={() => setUseOwnKey(!useOwnKey)}
              className="flex items-center gap-2 text-sm text-compass-muted hover:text-compass-text transition-colors mb-3"
            >
              {useOwnKey ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Use your own Anthropic API key
            </button>

            {useOwnKey && (
              <div className="space-y-3 pl-6 border-l-2 border-compass-border">
                <div>
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
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-compass-card/50 border border-compass-border/50">
                  <Shield className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-neutral-400">
                    Your key is encrypted with your OS keychain and stored locally.
                    Sent directly to the Anthropic API — never to Compass servers.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-compass-muted hover:text-compass-text"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={useOwnKey && !apiKey}
                className={clsx(
                  "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                  !(useOwnKey && !apiKey)
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
