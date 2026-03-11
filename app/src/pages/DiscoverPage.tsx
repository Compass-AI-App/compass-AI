import { useState } from "react";
import { Download, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useOpportunitiesStore } from "../stores/opportunities";
import OpportunityCard from "../components/discover/OpportunityCard";
import SpecView from "../components/discover/SpecView";

export default function DiscoverPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const {
    opportunities,
    loading,
    error,
    activeSpec,
    specLoading,
    specError,
    runDiscover,
    generateSpec,
    setActiveSpec,
  } = useOpportunitiesStore();

  const [exporting, setExporting] = useState(false);

  function handleGenerateSpec(title: string) {
    if (workspacePath) generateSpec(workspacePath, title);
  }

  async function handleExportReport() {
    if (!workspacePath) return;
    setExporting(true);
    try {
      const res = (await window.compass?.engine.call("/report", {
        workspace_path: workspacePath,
        format: "html",
      })) as { content?: string } | undefined;
      if (res?.content) {
        const blob = new Blob([res.content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "compass-report.html";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently ignore
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="w-6 h-6 text-compass-accent" />
        <h1 className="text-2xl font-semibold text-compass-text">Discover</h1>
      </div>

      {/* Hero + action */}
      <div className="rounded-xl bg-gradient-to-br from-compass-accent/10 to-compass-card border border-compass-accent/20 p-6 mb-6">
        <h2 className="text-lg font-medium text-compass-text mb-2">
          What should you build next?
        </h2>
        <p className="text-sm text-neutral-400 mb-4">
          Compass analyzes all four sources of truth — Code, Docs, Data, and Judgment — to surface
          evidence-grounded product opportunities.
        </p>
        <button
          onClick={() => workspacePath && runDiscover(workspacePath)}
          disabled={loading || !workspacePath}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
            loading
              ? "bg-compass-accent/50 text-white cursor-wait"
              : "bg-compass-accent hover:bg-compass-accent-hover text-white"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? "Discovering..." : opportunities.length > 0 ? "Re-discover" : "Discover"}
        </button>
        {opportunities.length > 0 && (
          <button
            onClick={handleExportReport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-compass-border text-compass-muted hover:text-compass-text hover:border-compass-text/30 transition-colors"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export Report
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => workspacePath && runDiscover(workspacePath)}
            className="text-sm text-compass-accent hover:underline mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Spec error */}
      {specError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 mb-4">
          <p className="text-red-400 text-sm">{specError}</p>
        </div>
      )}

      {/* Opportunity list */}
      {loading ? (
        <div className="text-center py-12 text-compass-muted">
          Reconciling sources and synthesizing opportunities...
        </div>
      ) : opportunities.length === 0 && !error ? (
        <div className="text-center py-12 text-compass-muted">
          No opportunities yet. Click Discover to analyze your evidence.
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.rank}
              opportunity={opp}
              onGenerateSpec={handleGenerateSpec}
              specLoading={specLoading}
            />
          ))}
        </div>
      )}

      {/* Spec slide-over */}
      {activeSpec && (
        <SpecView
          title={activeSpec.title}
          markdown={activeSpec.markdown}
          cursorMarkdown={activeSpec.cursorMarkdown}
          claudeCodeMarkdown={activeSpec.claudeCodeMarkdown}
          onClose={() => setActiveSpec(null)}
        />
      )}
    </div>
  );
}
