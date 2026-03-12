import { useState, useEffect } from "react";
import { Blocks, Copy, Check, X } from "lucide-react";

interface ComponentInfo {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface ComponentLibraryProps {
  onInsert: (html: string) => void;
  onClose: () => void;
}

export default function ComponentLibrary({ onInsert, onClose }: ComponentLibraryProps) {
  const [components, setComponents] = useState<ComponentInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHtml, setSelectedHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = (await window.compass.engine.call("/prototype/components", undefined)) as {
          components: ComponentInfo[];
        };
        // engine.call uses POST by default, but we need GET — use the endpoint directly
        setComponents(res.components || []);
      } catch {
        // Fallback: try fetching from the engine directly
        try {
          const port = 9811;
          const resp = await fetch(`http://localhost:${port}/prototype/components`);
          const data = await resp.json();
          setComponents(data.components || []);
        } catch {
          // Component library not available
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSelect(id: string) {
    setSelectedId(id);
    try {
      const port = 9811;
      const resp = await fetch(`http://localhost:${port}/prototype/components/${id}`);
      const data = await resp.json();
      setSelectedHtml(data.html || "");
    } catch {
      setSelectedHtml("");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(selectedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const categories = [...new Set(components.map((c) => c.category))];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-compass-card border border-compass-border rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-compass-border">
          <div className="flex items-center gap-2">
            <Blocks className="w-5 h-5 text-compass-accent" />
            <h2 className="text-lg font-semibold text-compass-text">Component Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-compass-muted hover:text-compass-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Component list */}
          <div className="w-72 border-r border-compass-border overflow-y-auto p-4 space-y-4">
            {loading ? (
              <p className="text-sm text-compass-muted">Loading...</p>
            ) : (
              categories.map((cat) => (
                <div key={cat}>
                  <h3 className="text-xs font-medium text-compass-muted uppercase tracking-wider mb-2">
                    {cat}
                  </h3>
                  <div className="space-y-1">
                    {components
                      .filter((c) => c.category === cat)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelect(c.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selectedId === c.id
                              ? "bg-compass-accent/10 text-compass-accent"
                              : "text-compass-muted hover:text-compass-text hover:bg-white/5"
                          }`}
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs opacity-60">{c.description}</div>
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col">
            {selectedHtml ? (
              <>
                <div className="flex-1 bg-white overflow-auto">
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body>${selectedHtml}</body></html>`}
                    sandbox="allow-scripts"
                    className="w-full h-full border-0"
                    title="Component preview"
                  />
                </div>
                <div className="flex items-center gap-2 p-3 border-t border-compass-border">
                  <button
                    onClick={() => onInsert(selectedHtml)}
                    className="px-4 py-2 bg-compass-accent text-white rounded-lg text-sm font-medium hover:bg-compass-accent/80 transition-colors"
                  >
                    Use in Description
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy HTML"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-compass-muted">
                  Select a component to preview
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
