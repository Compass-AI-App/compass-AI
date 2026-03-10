import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Code2, FileText, BarChart3, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../../stores/workspace";
import { useNavigate } from "react-router-dom";
import type { Evidence, SourceType } from "../../types/engine";

const sourceIcons: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  code: Code2,
  docs: FileText,
  data: BarChart3,
  judgment: MessageSquare,
};

const sourceColors: Record<SourceType, string> = {
  code: "text-compass-code",
  docs: "text-compass-docs",
  data: "text-compass-data",
  judgment: "text-compass-judgment",
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !workspacePath) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = (await window.compass.engine.call("/search", {
          workspace_path: workspacePath,
          query: q,
          limit: 10,
        })) as { status: string; items: Evidence[] };

        if (res.status === "ok") setResults(res.items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workspacePath]
  );

  function handleInputChange(value: string) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function handleSelectResult() {
    setOpen(false);
    navigate("/evidence");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg">
        <div className="rounded-xl bg-compass-sidebar border border-compass-border shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-compass-border">
            <Search className="w-5 h-5 text-compass-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search evidence..."
              className="flex-1 bg-transparent text-sm text-compass-text placeholder:text-neutral-600 focus:outline-none"
            />
            <kbd className="text-xs text-compass-muted bg-compass-card px-1.5 py-0.5 rounded border border-compass-border">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-compass-muted">Searching...</div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-compass-muted">
                No results for "{query}"
              </div>
            )}

            {!loading &&
              results.map((item) => {
                const Icon = sourceIcons[item.source_type] || FileText;
                return (
                  <button
                    key={item.id}
                    onClick={handleSelectResult}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <Icon className={clsx("w-4 h-4 shrink-0", sourceColors[item.source_type])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-compass-text truncate">{item.title}</p>
                      <p className="text-xs text-compass-muted truncate">{item.content}</p>
                    </div>
                    <span className="text-xs text-compass-muted shrink-0">{item.source_type}</span>
                  </button>
                );
              })}

            {!query && (
              <div className="px-4 py-6 text-center text-xs text-compass-muted">
                Type to search across all evidence
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
