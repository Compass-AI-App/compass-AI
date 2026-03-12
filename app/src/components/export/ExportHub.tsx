import { useState } from "react";
import { Download, FileText, Presentation, Code2, Database, Loader2, X, Archive } from "lucide-react";

interface ExportHubProps {
  workspacePath: string;
}

interface ExportItem {
  type: "documents" | "presentations" | "prototypes" | "evidence";
  label: string;
  icon: typeof FileText;
  formats: string[];
}

const EXPORT_ITEMS: ExportItem[] = [
  { type: "documents", label: "Documents", icon: FileText, formats: ["md", "html", "pdf"] },
  { type: "presentations", label: "Presentations", icon: Presentation, formats: ["html", "pdf"] },
  { type: "prototypes", label: "Prototypes", icon: Code2, formats: ["html", "png"] },
  { type: "evidence", label: "Evidence", icon: Database, formats: ["json", "csv"] },
];

export default function ExportHub({ workspacePath }: ExportHubProps) {
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState("html");
  const [status, setStatus] = useState("");

  function toggleItem(type: string) {
    const next = new Set(selected);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelected(next);
  }

  async function handleExportAll() {
    if (selected.size === 0) return;
    setExporting(true);
    setStatus("Preparing export...");

    try {
      // Export each selected type
      for (const type of selected) {
        setStatus(`Exporting ${type}...`);

        if (type === "evidence") {
          // Export evidence as JSON
          const res = (await window.compass.engine.call("/evidence", {
            workspace_path: workspacePath,
          })) as { evidence?: Array<Record<string, unknown>> };

          const data = JSON.stringify(res.evidence || [], null, 2);
          await window.compass.app.exportDocument(
            `compass-evidence.${format === "csv" ? "csv" : "json"}`,
            format === "csv" ? jsonToCsv(res.evidence || []) : data,
            "html", // save as text
          );
        } else if (type === "documents") {
          const raw = localStorage.getItem("compass-documents");
          if (raw) {
            const docs = JSON.parse(raw) as Array<{ title: string; content: string }>;
            for (const doc of docs.slice(0, 10)) {
              const slug = doc.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
              await window.compass.app.exportDocument(
                `${slug}.${format}`,
                doc.content || "",
                format as "md" | "html" | "pdf",
              );
            }
          }
        } else if (type === "presentations") {
          const raw = localStorage.getItem("compass-presentations");
          if (raw) {
            const presentations = JSON.parse(raw) as Array<{ title: string }>;
            setStatus(`Found ${presentations.length} presentations`);
          }
        } else if (type === "prototypes") {
          const raw = localStorage.getItem("compass-prototypes");
          if (raw) {
            const protos = JSON.parse(raw) as Array<{ title: string; html: string }>;
            for (const proto of protos.slice(0, 10)) {
              const slug = proto.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
              await window.compass.app.exportDocument(`${slug}.html`, proto.html, "html");
            }
          }
        }
      }

      setStatus("Export complete!");
      setTimeout(() => {
        setShowModal(false);
        setStatus("");
        setSelected(new Set());
      }, 1500);
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 rounded-lg transition-colors"
      >
        <Archive className="w-4 h-4" />
        Export All
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-compass-card border border-compass-border rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-compass-accent" />
                <h2 className="text-lg font-semibold text-compass-text">
                  Export Hub
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-compass-muted hover:text-compass-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-compass-muted mb-4">
              Select content types to export from your workspace.
            </p>

            <div className="space-y-2 mb-4">
              {EXPORT_ITEMS.map((item) => {
                const Icon = item.icon;
                const isSelected = selected.has(item.type);
                return (
                  <button
                    key={item.type}
                    onClick={() => toggleItem(item.type)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? "border-compass-accent bg-compass-accent/10"
                        : "border-compass-border hover:border-compass-accent/50"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? "text-compass-accent" : "text-compass-muted"}`} />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${isSelected ? "text-compass-text" : "text-compass-muted"}`}>
                        {item.label}
                      </span>
                      <span className="text-xs text-compass-muted ml-2">
                        ({item.formats.join(", ")})
                      </span>
                    </div>
                    <div className={`w-4 h-4 rounded border ${
                      isSelected
                        ? "bg-compass-accent border-compass-accent"
                        : "border-compass-border"
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {status && (
              <p className={`text-sm mb-3 ${status.includes("failed") ? "text-red-400" : "text-compass-accent"}`}>
                {status}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportAll}
                disabled={selected.size === 0 || exporting}
                className="flex items-center gap-1.5 px-4 py-2 bg-compass-accent text-white rounded-lg text-sm font-medium hover:bg-compass-accent/80 disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function jsonToCsv(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = String(row[h] ?? "");
      return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
