import { useState } from "react";
import {
  Compass,
  ArrowRight,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useWorkspaceManager } from "../stores/workspaceManager";
import { useNavigate } from "react-router-dom";
import StepSignIn from "../components/onboarding/StepSignIn";
import StepTemplate from "../components/onboarding/StepTemplate";
import StepSources from "../components/onboarding/StepSources";

type Step = "welcome" | "signin" | "template" | "setup" | "sources" | "launching";

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

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended_sources: string[];
  default_chat_mode: string;
  example_questions: string[];
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const addWorkspaceEntry = useWorkspaceManager((s) => s.addWorkspace);
  const navigate = useNavigate();

  const stepIndex = ["welcome", "signin", "template", "setup", "sources"].indexOf(step);
  const totalSteps = 5;

  function handleTemplateSelect(template: TemplateInfo | null) {
    setSelectedTemplate(template);
    if (template) {
      setProductName("");
      setProductDesc(template.description);
    }
    setStep("setup");
  }

  async function handlePickFolder() {
    const selected = await window.compass?.app.selectDirectory();
    if (selected) setWorkspacePath(selected);
  }

  async function handleFinish(sources: { type: string; path: string; name: string }[]) {
    if (!workspacePath) return;
    setStep("launching");

    try {
      // Initialize workspace (with template or plain)
      if (selectedTemplate) {
        await window.compass?.engine.call("/templates/init", {
          workspace_path: workspacePath,
          template_id: selectedTemplate.id,
          product_name: productName,
          product_description: productDesc,
        });
      } else {
        await window.compass?.engine.call("/init", {
          workspace_path: workspacePath,
          name: productName,
          description: productDesc,
        });
      }

      // Connect sources
      for (const source of sources) {
        try {
          await window.compass?.engine.call("/connect", {
            workspace_path: workspacePath,
            source_type: source.type,
            name: source.name,
            path: source.path || undefined,
          });
        } catch (err) {
          console.error(`Failed to connect source ${source.name}:`, err);
        }
      }

      // Register workspace
      setWorkspace(workspacePath, productName, productDesc);
      await addWorkspaceEntry({
        name: productName,
        description: productDesc,
        path: workspacePath,
      });

      // Auto-trigger ingestion
      if (sources.length > 0) {
        useWorkspaceStore.getState().triggerIngestion(workspacePath);
      }

      completeOnboarding();
      navigate("/workspace");
    } catch (err) {
      console.error("Onboarding finish failed:", err);
      setStep("sources");
    }
  }

  return (
    <div className="min-h-screen bg-compass-bg flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Progress */}
        {step !== "launching" && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={clsx(
                  "w-2.5 h-2.5 rounded-full transition-colors",
                  i <= stepIndex ? "bg-compass-accent" : "bg-compass-border"
                )}
              />
            ))}
          </div>
        )}

        {/* Step: Welcome */}
        {step === "welcome" && (
          <div className="text-center">
            <Compass className="w-16 h-16 text-compass-accent mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-compass-text mb-3">
              Welcome to Compass
            </h1>
            <p className="text-neutral-400 mb-2">
              The AI-native product discovery tool.
            </p>
            <p className="text-sm text-neutral-500 mb-8 max-w-sm mx-auto">
              Connect your product's sources of truth — code, docs, data,
              and user feedback — to surface evidence-grounded opportunities.
            </p>
            <button
              onClick={() => setStep("signin")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-compass-accent hover:bg-compass-accent-hover text-white font-medium transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Sign In */}
        {step === "signin" && (
          <StepSignIn onNext={() => setStep("template")} />
        )}

        {/* Step: Template */}
        {step === "template" && (
          <StepTemplate
            onSelect={handleTemplateSelect}
            onBack={() => setStep("signin")}
          />
        )}

        {/* Step: Setup (name + folder) */}
        {step === "setup" && (
          <div>
            <div className="text-center mb-6">
              <FolderOpen className="w-12 h-12 text-compass-accent mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-compass-text mb-2">
                Name Your Product
              </h2>
              {selectedTemplate && (
                <p className="text-xs text-compass-muted">
                  Template: {selectedTemplate.name}
                </p>
              )}
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
                onClick={() => setStep("template")}
                className="text-sm text-compass-muted hover:text-compass-text"
              >
                Back
              </button>
              <button
                onClick={() => setStep("sources")}
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

        {/* Step: Sources */}
        {step === "sources" && workspacePath && (
          <StepSources
            recommendedSources={selectedTemplate?.recommended_sources || []}
            workspacePath={workspacePath}
            onNext={handleFinish}
            onBack={() => setStep("setup")}
          />
        )}

        {/* Launching */}
        {step === "launching" && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-compass-accent mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-compass-text mb-2">
              Setting up your workspace...
            </h2>
            <p className="text-sm text-neutral-400">
              Initializing project and connecting sources.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
