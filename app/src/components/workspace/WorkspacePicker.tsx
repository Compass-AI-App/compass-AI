import { FolderOpen, Plus, Trash2, Clock } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceManager, type WorkspaceEntry } from "../../stores/workspaceManager";

interface Props {
  onSelect: (ws: WorkspaceEntry) => void;
  onCreateNew: () => void;
}

export default function WorkspacePicker({ onSelect, onCreateNew }: Props) {
  const { workspaces, removeWorkspace } = useWorkspaceManager();

  const sorted = [...workspaces].sort(
    (a, b) => new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
  );

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md p-8">
        <h1 className="text-xl font-semibold text-compass-text mb-1">Welcome to Compass</h1>
        <p className="text-sm text-compass-muted mb-6">
          Open an existing product workspace or create a new one.
        </p>

        {sorted.length > 0 && (
          <div className="space-y-2 mb-6">
            {sorted.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-compass-card border border-compass-border hover:border-compass-accent/30 transition-colors group"
              >
                <button
                  onClick={() => onSelect(ws)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <FolderOpen className="w-5 h-5 text-compass-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-compass-text truncate">{ws.name}</p>
                    <div className="flex items-center gap-1 text-xs text-compass-muted">
                      <Clock className="w-3 h-3" />
                      {new Date(ws.last_opened).toLocaleDateString()}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => removeWorkspace(ws.id)}
                  className="opacity-0 group-hover:opacity-100 text-compass-muted hover:text-red-400 transition-all"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-compass-border text-sm text-compass-muted hover:text-compass-text hover:border-compass-accent/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New Product
        </button>
      </div>
    </div>
  );
}
