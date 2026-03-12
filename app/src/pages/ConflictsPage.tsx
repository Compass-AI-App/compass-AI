import { AlertTriangle, Loader2, Play } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useConflictsStore } from "../stores/conflicts";
import ConflictCard from "../components/conflicts/ConflictCard";
import ConflictMatrix from "../components/conflicts/ConflictMatrix";

export default function ConflictsPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const { conflicts, loading, runReconcile } = useConflictsStore();

  const highCount = conflicts.filter((c) => c.severity === "high").length;
  const medCount = conflicts.filter((c) => c.severity === "medium").length;
  const lowCount = conflicts.filter((c) => c.severity === "low").length;

  const sorted = [...conflicts].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-compass-accent" />
        <h1 className="text-2xl font-semibold text-compass-text">Conflicts</h1>
      </div>

      {/* Summary bar + action */}
      <div className="flex items-center gap-4 mb-6">
        {conflicts.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-compass-text font-medium">{conflicts.length} conflicts:</span>
            {highCount > 0 && <span className="text-red-400">{highCount} high</span>}
            {medCount > 0 && <span className="text-amber-400">{medCount} medium</span>}
            {lowCount > 0 && <span className="text-neutral-400">{lowCount} low</span>}
          </div>
        )}
        <button
          onClick={() => workspacePath && runReconcile(workspacePath)}
          disabled={loading || !workspacePath}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto",
            loading
              ? "bg-compass-accent/50 text-white cursor-wait"
              : "bg-compass-accent hover:bg-compass-accent-hover text-white"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {loading ? "Reconciling..." : conflicts.length > 0 ? "Re-run Reconciliation" : "Run Reconciliation"}
        </button>
      </div>

      {/* Conflict matrix */}
      {conflicts.length > 0 && (
        <div className="mb-6">
          <ConflictMatrix conflicts={conflicts} />
        </div>
      )}

      {/* Conflict list */}
      {loading ? (
        <div className="text-center py-12 text-compass-muted">
          Analyzing source pairs for conflicts...
        </div>
      ) : conflicts.length === 0 ? (
        <div className="rounded-xl bg-compass-card border border-compass-border p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-compass-muted mx-auto mb-3" />
          <p className="text-compass-muted">
            No conflicts found yet. Run reconciliation to compare your sources of truth.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((c, i) => (
            <ConflictCard key={`${c.conflict_type}-${i}`} conflict={c} />
          ))}
        </div>
      )}
    </div>
  );
}
