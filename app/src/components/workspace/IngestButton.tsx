import { Loader2, Play, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../../stores/workspace";

export default function IngestButton() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const sources = useWorkspaceStore((s) => s.sources);
  const isIngesting = useWorkspaceStore((s) => s.isIngesting);
  const setIngesting = useWorkspaceStore((s) => s.setIngesting);
  const setIngestionResults = useWorkspaceStore((s) => s.setIngestionResults);
  const evidenceCount = useWorkspaceStore((s) => s.evidenceCount);
  const ingestionResults = useWorkspaceStore((s) => s.ingestionResults);

  async function handleIngest() {
    if (!workspacePath || sources.length === 0) return;
    setIngesting(true);

    try {
      const res = (await window.compass.engine.call("/ingest", {
        workspace_path: workspacePath,
      })) as {
        status: string;
        total: number;
        sources: { name: string; type: string; items: number; error?: string }[];
        summary: Record<string, number>;
      };

      if (res.status === "ok") {
        setIngestionResults(res.sources, res.total, res.summary);
      }
    } catch (err) {
      console.error("Ingest failed:", err);
    } finally {
      setIngesting(false);
    }
  }

  const hasResults = ingestionResults.length > 0;

  return (
    <div className="space-y-3">
      <button
        onClick={handleIngest}
        disabled={isIngesting || sources.length === 0}
        className={clsx(
          "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
          sources.length === 0
            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            : isIngesting
            ? "bg-compass-accent/50 text-white cursor-wait"
            : "bg-compass-accent hover:bg-compass-accent-hover text-white"
        )}
      >
        {isIngesting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : hasResults ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {isIngesting ? "Ingesting..." : hasResults ? "Re-ingest All Sources" : "Ingest All Sources"}
      </button>

      {hasResults && (
        <div className="rounded-lg bg-compass-card border border-compass-border p-4">
          <p className="text-sm font-medium text-compass-text mb-2">
            {evidenceCount} evidence items from {ingestionResults.length} sources
          </p>
          <div className="space-y-1">
            {ingestionResults.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <span className="text-compass-muted">{r.name}</span>
                <span className={r.error ? "text-red-400" : "text-compass-text"}>
                  {r.error ? "Error" : `${r.items} items`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
