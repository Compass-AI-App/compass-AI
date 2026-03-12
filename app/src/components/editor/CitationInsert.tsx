import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { BookMarked, Search, X } from "lucide-react";
import { clsx } from "clsx";

interface EvidenceItem {
  id: string;
  text: string;
  source_type: string;
  connector: string;
  metadata: Record<string, unknown>;
}

interface CitationInsertProps {
  editor: Editor | null;
  workspacePath: string;
}

export default function CitationInsert({
  editor,
  workspacePath,
}: CitationInsertProps) {
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [allEvidence, setAllEvidence] = useState<EvidenceItem[]>([]);

  useEffect(() => {
    if (!showModal || !workspacePath) return;
    // Load all evidence on modal open
    (async () => {
      try {
        const res = (await window.compass.engine.call("/evidence", {
          workspace_path: workspacePath,
        })) as { status: string; items: EvidenceItem[] };
        if (res.status === "ok") {
          setAllEvidence(res.items);
          setResults(res.items.slice(0, 20));
        }
      } catch {
        // ignore
      }
    })();
  }, [showModal, workspacePath]);

  async function handleSearch() {
    if (!query.trim()) {
      setResults(allEvidence.slice(0, 20));
      return;
    }
    setLoading(true);
    try {
      const res = (await window.compass.engine.call("/search", {
        workspace_path: workspacePath,
        query: query.trim(),
        limit: 20,
      })) as { status: string; results: EvidenceItem[] };
      if (res.status === "ok") {
        setResults(res.results);
      }
    } catch {
      // Fall back to client-side filtering
      const lower = query.toLowerCase();
      setResults(
        allEvidence.filter(
          (e) =>
            e.text.toLowerCase().includes(lower) ||
            e.source_type.toLowerCase().includes(lower) ||
            e.connector.toLowerCase().includes(lower),
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function insertCitation(evidence: EvidenceItem) {
    if (!editor) return;

    const citationText = `[${evidence.source_type}: ${evidence.text.slice(0, 60)}${evidence.text.length > 60 ? "..." : ""}]`;

    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: citationText,
        marks: [
          {
            type: "citation",
            attrs: {
              evidenceId: evidence.id,
              source: evidence.source_type,
            },
          },
        ],
      })
      .run();

    setShowModal(false);
    setQuery("");
  }

  if (!editor) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 rounded-lg transition-colors"
        title="Insert evidence citation"
      >
        <BookMarked className="w-4 h-4" />
        Cite
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-compass-card border border-compass-border rounded-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-compass-text">
                Insert Citation
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setQuery("");
                }}
                className="p-1 text-compass-muted hover:text-compass-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-compass-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search evidence..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-compass-bg border border-compass-border text-compass-text text-sm focus:outline-none focus:border-compass-accent"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-3 py-2 text-sm bg-compass-accent text-white rounded-lg hover:bg-compass-accent/90 transition-colors"
              >
                Search
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {results.length === 0 ? (
                <p className="text-sm text-compass-muted text-center py-8">
                  {loading ? "Searching..." : "No evidence found"}
                </p>
              ) : (
                results.map((evidence) => (
                  <button
                    key={evidence.id}
                    onClick={() => insertCitation(evidence)}
                    className={clsx(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      "border-compass-border hover:border-compass-accent/30 hover:bg-white/5",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 text-xs rounded bg-compass-accent/20 text-compass-accent">
                        {evidence.source_type}
                      </span>
                      <span className="text-xs text-compass-muted">
                        {evidence.connector}
                      </span>
                    </div>
                    <p className="text-sm text-compass-text/80 line-clamp-2">
                      {evidence.text}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
