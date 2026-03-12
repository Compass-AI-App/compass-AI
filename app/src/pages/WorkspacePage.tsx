import { useState, useEffect } from "react";
import { Home, Plus, Building2, Smartphone, Boxes, Store, Wrench, ArrowLeft } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useWorkspaceManager } from "../stores/workspaceManager";
import SourceConnector from "../components/workspace/SourceConnector";
import IngestButton from "../components/workspace/IngestButton";
import WorkspacePicker from "../components/workspace/WorkspacePicker";
import WeeklyPlanWidget from "../components/workspace/WeeklyPlanWidget";
import GitPush from "../components/workspace/GitPush";

export default function WorkspacePage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const productName = useWorkspaceStore((s) => s.productName);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const sources = useWorkspaceStore((s) => s.sources);
  const evidenceCount = useWorkspaceStore((s) => s.evidenceCount);
  const evidenceSummary = useWorkspaceStore((s) => s.evidenceSummary);
  const { workspaces, loaded, loadWorkspaces, addWorkspace, openWorkspace } = useWorkspaceManager();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!loaded) loadWorkspaces();
  }, [loaded]);

  useEffect(() => {
    if (loaded && !workspacePath) {
      const mgr = useWorkspaceManager.getState();
      const active = mgr.getActiveWorkspace();
      if (active) {
        setWorkspace(active.path, active.name, active.description);
      }
    }
  }, [loaded]);

  // Load workspace state from engine and auto-ingest if needed
  useEffect(() => {
    if (!workspacePath) return;
    (async () => {
      try {
        const info = (await window.compass.engine.call("/workspace/info", {
          workspace_path: workspacePath,
        })) as {
          status: string;
          name: string;
          description: string;
          sources: Array<{ type: string; name: string; path?: string }>;
          evidence_count: number;
        };
        if (info.status === "ok") {
          // Populate sources in the store
          const store = useWorkspaceStore.getState();
          store.setSources(
            info.sources.map((s) => ({
              type: s.type,
              name: s.name,
              path: s.path ?? null,
              url: null,
              options: {},
            }))
          );
          // If sources exist but no evidence, auto-ingest
          if (info.sources.length > 0 && info.evidence_count === 0 && !store.isIngesting) {
            store.triggerIngestion(workspacePath);
          }
          // If evidence exists, update the count
          if (info.evidence_count > 0) {
            store.setIngestionResults([], info.evidence_count, {});
          }
        }
      } catch (err) {
        console.error("Failed to load workspace info:", err);
      }
    })();
  }, [workspacePath]);

  if (!workspacePath && !showCreate) {
    return (
      <WorkspacePicker
        onSelect={(ws) => {
          openWorkspace(ws.id);
          setWorkspace(ws.path, ws.name, ws.description);
        }}
        onCreateNew={() => setShowCreate(true)}
      />
    );
  }

  if (!workspacePath && showCreate) {
    return <CreateWorkspace onCancel={() => setShowCreate(false)} />;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Home className="w-6 h-6 text-compass-accent" />
        <h1 className="text-2xl font-semibold text-compass-text">{productName}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatusCard label="Sources" value={sources.length} />
        <StatusCard label="Evidence" value={evidenceCount} />
        <StatusCard
          label="Types"
          value={Object.keys(evidenceSummary).length}
          detail={Object.entries(evidenceSummary)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}
        />
      </div>

      {evidenceCount > 0 && workspacePath && (
        <section className="mb-8">
          <WeeklyPlanWidget workspacePath={workspacePath} />
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-medium text-compass-text mb-3">Connect Sources</h2>
        <SourceConnector />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-compass-text mb-3">Ingest Evidence</h2>
        <IngestButton />
      </section>

      {workspacePath && (
        <section>
          <h2 className="text-lg font-medium text-compass-text mb-3">Version Control</h2>
          <GitPush workspacePath={workspacePath} productName={productName || "my-product"} />
        </section>
      )}
    </div>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="rounded-xl bg-compass-card border border-compass-border p-4">
      <p className="text-2xl font-semibold text-compass-text">{value}</p>
      <p className="text-xs text-compass-muted mt-0.5">{label}</p>
      {detail && <p className="text-xs text-compass-muted mt-1 truncate">{detail}</p>}
    </div>
  );
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

const templateIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Smartphone,
  Boxes,
  Store,
  Wrench,
};

function CreateWorkspace({ onCancel }: { onCancel: () => void }) {
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const { addWorkspace } = useWorkspaceManager();
  const [step, setStep] = useState<"template" | "details">("template");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = (await window.compass.engine.call("/templates", {})) as {
          templates: TemplateInfo[];
        };
        setTemplates(res.templates || []);
      } catch {
        // Templates endpoint may not be available
      }
    })();
  }, []);

  function handleSelectTemplate(tmpl: TemplateInfo | null) {
    setSelectedTemplate(tmpl);
    setStep("details");
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);

    try {
      const dir = await window.compass.app.selectDirectory();
      if (!dir) {
        setCreating(false);
        return;
      }

      if (selectedTemplate) {
        const res = (await window.compass.engine.call("/templates/init", {
          workspace_path: dir,
          template_id: selectedTemplate.id,
          product_name: name.trim(),
          product_description: desc.trim(),
        })) as { status: string };

        if (res.status === "ok") {
          await addWorkspace({ name: name.trim(), description: desc.trim(), path: dir });
          setWorkspace(dir, name.trim(), desc.trim());
        }
      } else {
        const res = (await window.compass.engine.call("/init", {
          workspace_path: dir,
          name: name.trim(),
          description: desc.trim(),
        })) as { status: string };

        if (res.status === "ok") {
          await addWorkspace({ name: name.trim(), description: desc.trim(), path: dir });
          setWorkspace(dir, name.trim(), desc.trim());
        }
      }
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setCreating(false);
    }
  }

  if (step === "template") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-full max-w-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-compass-accent/10">
              <Plus className="w-5 h-5 text-compass-accent" />
            </div>
            <h1 className="text-xl font-semibold text-compass-text">Choose a Template</h1>
          </div>

          <div className="space-y-2 mb-4">
            {templates.map((tmpl) => {
              const Icon = templateIcons[tmpl.icon] || Boxes;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-compass-card border border-compass-border text-left hover:border-compass-accent/50 transition-colors"
                >
                  <Icon className="w-5 h-5 text-compass-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-compass-text">{tmpl.name}</p>
                    <p className="text-xs text-compass-muted truncate">{tmpl.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-sm border border-compass-border text-compass-muted hover:text-compass-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSelectTemplate(null)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-compass-muted hover:text-compass-text border border-compass-border hover:border-compass-accent/50 transition-colors"
            >
              Start from Scratch
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStep("template")}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-compass-muted" />
          </button>
          <div className="p-2 rounded-lg bg-compass-accent/10">
            <Plus className="w-5 h-5 text-compass-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-compass-text">Create New Product</h1>
            {selectedTemplate && (
              <p className="text-xs text-compass-muted">Template: {selectedTemplate.name}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-compass-muted mb-1.5">Product Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SyncFlow"
              className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-compass-muted mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Brief description of your product..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent resize-none"
            />
          </div>
          {selectedTemplate && (
            <div className="rounded-lg bg-compass-accent/5 border border-compass-accent/20 p-3">
              <p className="text-xs font-medium text-compass-accent mb-1">Pre-configured sources</p>
              <p className="text-xs text-compass-muted">
                {selectedTemplate.recommended_sources.join(", ")}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-sm border border-compass-border text-compass-muted hover:text-compass-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className={clsx(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors",
                name.trim() && !creating
                  ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
                  : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              )}
            >
              {creating ? "Creating..." : "Create & Choose Folder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
