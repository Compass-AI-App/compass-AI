import { useEffect, useState } from "react";
import {
  Presentation as PresentationIcon,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { usePresentationsStore } from "../stores/presentations";
import type { SavedPresentation } from "../stores/presentations";
import SlideRenderer from "../components/slides/SlideRenderer";

const AUDIENCES = [
  { value: "engineering", label: "Engineering" },
  { value: "leadership", label: "Leadership" },
  { value: "board", label: "Board" },
  { value: "customer", label: "Customer" },
  { value: "cross-functional", label: "Cross-functional" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function NewPresentationModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void;
  onCreate: (topic: string, audience: string, slideCount: number) => void;
  loading: boolean;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("cross-functional");
  const [slideCount, setSlideCount] = useState(8);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-compass-card border border-compass-border rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-compass-text mb-4">
          New Presentation
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-compass-muted mb-1">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Q1 Product Strategy Update"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-compass-bg border border-compass-border text-compass-text text-sm focus:outline-none focus:border-compass-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-compass-muted mb-1">
              Audience
            </label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAudience(a.value)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                    audience === a.value
                      ? "border-compass-accent bg-compass-accent/10 text-compass-accent"
                      : "border-compass-border text-compass-muted hover:text-compass-text hover:bg-white/5",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-compass-muted mb-1">
              Slides: {slideCount}
            </label>
            <input
              type="range"
              min={4}
              max={16}
              value={slideCount}
              onChange={(e) => setSlideCount(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(topic, audience, slideCount)}
            disabled={!topic.trim() || loading}
            className={clsx(
              "px-4 py-2 text-sm bg-compass-accent text-white rounded-lg hover:bg-compass-accent/90 transition-colors",
              (!topic.trim() || loading) && "opacity-50",
            )}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PresentationList({
  presentations,
  onSelect,
  onDelete,
  onNew,
}: {
  presentations: SavedPresentation[];
  onSelect: (p: SavedPresentation) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-compass-text">
          Presentations
        </h2>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-compass-accent text-white rounded-lg hover:bg-compass-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Presentation
        </button>
      </div>

      {presentations.length === 0 ? (
        <div className="text-center py-16">
          <PresentationIcon className="w-12 h-12 text-compass-muted/30 mx-auto mb-3" />
          <p className="text-compass-muted text-sm">No presentations yet</p>
          <p className="text-compass-muted/60 text-xs mt-1">
            Generate your first slide deck from evidence
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {presentations.map((pres) => (
            <button
              key={pres.id}
              onClick={() => onSelect(pres)}
              className="flex items-start gap-4 p-4 bg-compass-card border border-compass-border rounded-xl hover:border-compass-accent/30 transition-colors text-left group"
            >
              <PresentationIcon className="w-5 h-5 text-compass-muted shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-compass-text block truncate">
                  {pres.title}
                </span>
                <div className="flex items-center gap-3 text-xs text-compass-muted mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(pres.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {pres.audience}
                  </span>
                  <span>{pres.slides.length} slides</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(pres.id);
                }}
                className="p-1.5 rounded-md text-compass-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PresentationsPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const {
    presentations,
    activePresentation,
    loading,
    error,
    generate,
    remove,
    setActive,
    loadSaved,
  } = usePresentationsStore();
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    loadSaved();
  }, []);

  async function handleCreate(
    topic: string,
    audience: string,
    slideCount: number,
  ) {
    if (!workspacePath) return;
    const pres = await generate(workspacePath, topic, audience, slideCount);
    if (pres) setShowNewModal(false);
  }

  if (!workspacePath) {
    return (
      <div className="flex items-center justify-center h-full text-compass-muted text-sm">
        Select a workspace to create presentations
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {activePresentation ? (
        <div className="space-y-4">
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-1 text-sm text-compass-muted hover:text-compass-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to presentations
          </button>
          <SlideRenderer presentation={activePresentation} />
        </div>
      ) : (
        <PresentationList
          presentations={presentations}
          onSelect={setActive}
          onDelete={remove}
          onNew={() => setShowNewModal(true)}
        />
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {showNewModal && (
        <NewPresentationModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
          loading={loading}
        />
      )}
    </div>
  );
}
