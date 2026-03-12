import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Code2, ArrowLeft, Blocks, GitBranch } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspace";
import { usePrototypesStore } from "../stores/prototypes";
import PrototypePreview from "../components/prototype/PrototypePreview";
import ComponentLibrary from "../components/prototype/ComponentLibrary";
import VariantComparison from "../components/prototype/VariantComparison";
import type { PrototypeData } from "../components/prototype/PrototypePreview";

const PROTOTYPE_TYPES = [
  { id: "landing-page", label: "Landing Page", desc: "Hero, features, CTA" },
  { id: "dashboard", label: "Dashboard", desc: "Metrics, charts, tables" },
  { id: "form", label: "Form", desc: "Input fields, validation" },
  { id: "pricing-page", label: "Pricing Page", desc: "Tiers, comparison" },
  { id: "onboarding-flow", label: "Onboarding", desc: "Step-by-step wizard" },
];

export default function PrototypesPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const {
    prototypes,
    activePrototype,
    loading,
    error,
    generate,
    save,
    remove,
    setActive,
    loadSaved,
  } = usePrototypesStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [variants, setVariants] = useState<PrototypeData[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [description, setDescription] = useState("");
  const [protoType, setProtoType] = useState("landing-page");

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  async function handleCreate() {
    if (!description.trim() || !workspacePath) return;
    setShowCreate(false);
    await generate(workspacePath, description.trim(), protoType);
    setDescription("");
    setProtoType("landing-page");
  }

  async function handleGenerateVariants() {
    if (!description.trim() || !workspacePath) return;
    setShowCreate(false);
    setGeneratingVariants(true);
    try {
      const res = (await window.compass.engine.call("/prototype/variants", {
        workspace_path: workspacePath,
        description: description.trim(),
        prototype_type: protoType,
        num_variants: 3,
      })) as { status: string; variants: PrototypeData[] };

      if (res.status === "ok" && res.variants?.length > 0) {
        setVariants(res.variants);
        setShowVariants(true);
      }
    } catch (err) {
      console.error("Variant generation failed:", err);
    } finally {
      setGeneratingVariants(false);
      setDescription("");
      setProtoType("landing-page");
    }
  }

  function handleSelectVariant(variant: PrototypeData) {
    const saved = {
      ...variant,
      id: `proto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    save(saved);
    setActive(saved);
    setShowVariants(false);
    setVariants([]);
  }

  function handleUpdate(updated: PrototypeData) {
    if (activePrototype) {
      save({ ...activePrototype, ...updated });
    }
  }

  if (!workspacePath) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-compass-muted text-sm">
          Open a workspace to create prototypes.
        </p>
      </div>
    );
  }

  // Active prototype view
  if (activePrototype) {
    return (
      <div className="flex-1 flex flex-col h-full p-6">
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-1.5 text-sm text-compass-muted hover:text-compass-text mb-4 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to prototypes
        </button>
        <div className="flex-1 min-h-0">
          <PrototypePreview
            prototype={activePrototype}
            workspacePath={workspacePath}
            onUpdate={handleUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-compass-text">Prototypes</h1>
          <p className="text-sm text-compass-muted mt-1">
            Generate UI prototypes from your evidence
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-compass-accent text-white rounded-lg text-sm font-medium hover:bg-compass-accent/80 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Prototype
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 px-4 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-compass-accent" />
          <span className="text-sm text-compass-muted">
            Generating prototype...
          </span>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-compass-card border border-compass-border rounded-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-compass-text">
              New Prototype
            </h2>

            <div>
              <label className="block text-sm font-medium text-compass-muted mb-1.5">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROTOTYPE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setProtoType(t.id)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      protoType === t.id
                        ? "border-compass-accent bg-compass-accent/10 text-compass-text"
                        : "border-compass-border text-compass-muted hover:border-compass-accent/50"
                    }`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs opacity-70">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-compass-muted">
                  Description
                </label>
                <button
                  type="button"
                  onClick={() => setShowLibrary(true)}
                  className="flex items-center gap-1 text-xs text-compass-accent hover:text-compass-accent/80 transition-colors"
                >
                  <Blocks className="w-3.5 h-3.5" />
                  Browse Components
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the prototype should show... (e.g., 'A landing page for a project management tool with hero, features, and pricing')"
                rows={3}
                className="w-full px-3 py-2 bg-compass-bg border border-compass-border rounded-lg text-sm text-compass-text placeholder:text-compass-muted focus:outline-none focus:border-compass-accent resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateVariants}
                disabled={!description.trim()}
                className="flex items-center gap-1.5 px-4 py-2 border border-compass-accent text-compass-accent rounded-lg text-sm font-medium hover:bg-compass-accent/10 disabled:opacity-50 transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                Generate Variants
              </button>
              <button
                onClick={handleCreate}
                disabled={!description.trim()}
                className="px-4 py-2 bg-compass-accent text-white rounded-lg text-sm font-medium hover:bg-compass-accent/80 disabled:opacity-50 transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant comparison modal */}
      {showVariants && variants.length > 0 && (
        <VariantComparison
          variants={variants}
          onSelect={handleSelectVariant}
          onClose={() => {
            setShowVariants(false);
            setVariants([]);
          }}
        />
      )}

      {generatingVariants && (
        <div className="flex items-center gap-3 px-4 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-compass-accent" />
          <span className="text-sm text-compass-muted">
            Generating variants...
          </span>
        </div>
      )}

      {/* Component library modal */}
      {showLibrary && (
        <ComponentLibrary
          onInsert={(html) => {
            setDescription((prev) =>
              prev
                ? `${prev}\n\nInclude this component:\n${html}`
                : `Include this component:\n${html}`,
            );
            setShowLibrary(false);
          }}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Prototype gallery */}
      {prototypes.length === 0 && !loading ? (
        <div className="text-center py-16">
          <Code2 className="w-12 h-12 text-compass-muted/30 mx-auto mb-4" />
          <p className="text-compass-muted text-sm">No prototypes yet</p>
          <p className="text-compass-muted/60 text-xs mt-1">
            Generate your first prototype from evidence
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prototypes.map((proto) => (
            <div
              key={proto.id}
              className="bg-compass-card border border-compass-border rounded-xl overflow-hidden hover:border-compass-accent/50 transition-colors group cursor-pointer"
              onClick={() => setActive(proto)}
            >
              {/* Thumbnail: mini iframe */}
              <div className="aspect-video bg-white overflow-hidden relative">
                <iframe
                  srcDoc={proto.html}
                  sandbox=""
                  className="w-[200%] h-[200%] border-0 origin-top-left pointer-events-none"
                  style={{ transform: "scale(0.5)" }}
                  title={proto.title}
                  tabIndex={-1}
                />
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-compass-text truncate">
                    {proto.title}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(proto.id);
                    }}
                    className="p-1 text-compass-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-compass-accent/15 text-compass-accent">
                    {proto.type}
                  </span>
                  <span className="text-xs text-compass-muted">
                    {new Date(proto.createdAt).toLocaleDateString()}
                  </span>
                  {proto.iterations.length > 1 && (
                    <span className="text-xs text-compass-muted">
                      v{proto.iterations.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
