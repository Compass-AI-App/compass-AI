import { useState } from "react";
import { Calendar, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  workspacePath: string;
}

export default function WeeklyPlanWidget({ workspacePath }: Props) {
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = (await window.compass.engine.call("/plan/week", {
        workspace_path: workspacePath,
      })) as { status: string; markdown: string };

      if (res.status === "ok") {
        setMarkdown(res.markdown);
      } else {
        setError("Failed to generate plan.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!markdown) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-compass-card border border-purple-500/20 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-medium text-compass-text">Weekly Plan</h3>
        </div>
        <p className="text-sm text-neutral-400 mb-4">
          Get an AI-synthesized view of what matters most this week — based on your evidence,
          opportunities, and conflicts.
        </p>
        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          {loading ? "Planning..." : "Plan My Week"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-compass-card border border-compass-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-medium text-compass-text">Weekly Plan</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-compass-border text-compass-muted hover:text-compass-text transition-colors"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </button>
      </div>
      <div className="prose prose-invert prose-sm max-w-none prose-headings:text-compass-text prose-p:text-neutral-400 prose-strong:text-compass-text prose-li:text-neutral-400">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
