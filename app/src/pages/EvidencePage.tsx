import { useEffect } from "react";
import { Database, Search } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useEvidenceStore } from "../stores/evidence";
import EvidenceCard from "../components/evidence/EvidenceCard";
import type { SourceType } from "../types/engine";

const TABS: { key: SourceType | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "code", label: "Code" },
  { key: "docs", label: "Docs" },
  { key: "data", label: "Data" },
  { key: "judgment", label: "Judgment" },
];

const tabColors: Record<string, string> = {
  code: "text-compass-code",
  docs: "text-compass-docs",
  data: "text-compass-data",
  judgment: "text-compass-judgment",
};

export default function EvidencePage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const { items, loading, filter, searchQuery, setFilter, setSearchQuery, fetchEvidence } =
    useEvidenceStore();

  useEffect(() => {
    if (workspacePath && items.length === 0) {
      fetchEvidence(workspacePath);
    }
  }, [workspacePath]);

  const filtered = items.filter((e) => {
    if (filter && e.source_type !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countByType = (type: SourceType) => items.filter((e) => e.source_type === type).length;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-compass-accent" />
        <h1 className="text-2xl font-semibold text-compass-text">Evidence</h1>
        <span className="text-sm text-compass-muted ml-auto">{items.length} items</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-compass-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search evidence..."
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-compass-card border border-compass-border text-sm text-compass-text placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-compass-border pb-2">
        {TABS.map(({ key, label }) => {
          const count = key ? countByType(key) : items.length;
          return (
            <button
              key={label}
              onClick={() => setFilter(key)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5",
                filter === key
                  ? "bg-white/10 text-compass-text"
                  : "text-compass-muted hover:text-compass-text hover:bg-white/5"
              )}
            >
              <span className={key ? tabColors[key] : ""}>{label}</span>
              <span className="text-xs text-compass-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Evidence list */}
      {loading ? (
        <div className="text-center py-12 text-compass-muted">Loading evidence...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-compass-muted">
          {items.length === 0
            ? "No evidence yet. Ingest sources from the Workspace page."
            : "No evidence matches your filter."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <EvidenceCard key={e.id} evidence={e} />
          ))}
        </div>
      )}
    </div>
  );
}
