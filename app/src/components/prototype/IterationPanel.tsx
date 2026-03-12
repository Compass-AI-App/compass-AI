import { useState } from "react";
import { Send, Loader2, History } from "lucide-react";

interface Iteration {
  prompt: string;
  html: string;
}

interface IterationPanelProps {
  iterations: Iteration[];
  onIterate: (prompt: string) => Promise<void>;
  onSelectVersion: (index: number) => void;
  currentVersion: number;
  isLoading: boolean;
}

export default function IterationPanel({
  iterations,
  onIterate,
  onSelectVersion,
  currentVersion,
  isLoading,
}: IterationPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    const p = prompt.trim();
    setPrompt("");
    await onIterate(p);
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe changes... (e.g., 'Make the hero section taller')"
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-compass-bg border border-compass-border rounded-lg text-sm text-compass-text placeholder:text-compass-muted focus:outline-none focus:border-compass-accent"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="px-3 py-2 bg-compass-accent text-white rounded-lg text-sm hover:bg-compass-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Iterate
        </button>
      </form>

      {iterations.length > 1 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-compass-muted hover:text-compass-text transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            {iterations.length} versions
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {iterations.map((iter, i) => (
                <button
                  key={i}
                  onClick={() => onSelectVersion(i)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                    i === currentVersion
                      ? "bg-compass-accent/20 text-compass-accent"
                      : "text-compass-muted hover:text-compass-text hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">v{i + 1}</span>
                  <span className="ml-2 truncate">{iter.prompt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
