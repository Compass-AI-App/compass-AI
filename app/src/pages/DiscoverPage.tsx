import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Download, FileText, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useOpportunitiesStore } from "../stores/opportunities";
import OpportunityCard from "../components/discover/OpportunityCard";
import SpecView from "../components/discover/SpecView";
import DocumentView from "../components/discover/DocumentView";

export default function DiscoverPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const {
    opportunities,
    loading,
    error,
    activeSpec,
    specLoading,
    specError,
    activeBrief,
    briefLoading,
    activeChallenge,
    challengeLoading,
    activeExperiment,
    experimentLoading,
    runDiscover,
    generateSpec,
    generateBrief,
    generateChallenge,
    designExperiment,
    setActiveSpec,
    setActiveBrief,
    setActiveChallenge,
    setActiveExperiment,
  } = useOpportunitiesStore();

  const [exporting, setExporting] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [history, setHistory] = useState<{ summary: Record<string, unknown>; runs: Record<string, unknown>[] } | null>(null);

  useEffect(() => {
    if (workspacePath && opportunities.length > 0) {
      window.compass?.engine.call("/history", { workspace_path: workspacePath })
        .then((res) => {
          const data = res as { status: string; summary: Record<string, unknown>; runs: Record<string, unknown>[] };
          if (data?.status === "ok") setHistory(data);
        })
        .catch(() => {});
    }
  }, [workspacePath, opportunities]);

  const [updatingStakeholder, setUpdatingStakeholder] = useState(false);
  const [activeUpdate, setActiveUpdate] = useState<{ title: string; markdown: string } | null>(null);

  function handleGenerateSpec(title: string) {
    if (workspacePath) generateSpec(workspacePath, title);
  }

  function handleGenerateBrief(title: string) {
    if (workspacePath) generateBrief(workspacePath, title);
  }

  function handleChallenge(title: string) {
    if (workspacePath) generateChallenge(workspacePath, title);
  }

  function handleDesignExperiment(title: string) {
    if (workspacePath) designExperiment(workspacePath, title);
  }

  async function handleWriteUpdate() {
    if (!workspacePath) return;
    setUpdatingStakeholder(true);
    try {
      const res = (await window.compass?.engine.call("/write/update", {
        workspace_path: workspacePath,
        days: 7,
      })) as { status: string; markdown: string } | undefined;
      if (res?.status === "ok") {
        setActiveUpdate({ title: "Stakeholder Update", markdown: res.markdown });
      }
    } catch {
      // silently ignore
    } finally {
      setUpdatingStakeholder(false);
    }
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
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleWriteUpdate}
              disabled={updatingStakeholder}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-compass-border text-compass-muted hover:text-compass-text hover:border-compass-text/30 transition-colors"
            >
              {updatingStakeholder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Write Update
            </button>
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
          </div>
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
              onGenerateBrief={handleGenerateBrief}
              onChallenge={handleChallenge}
              onDesignExperiment={handleDesignExperiment}
              specLoading={specLoading}
              briefLoading={briefLoading}
              challengeLoading={challengeLoading}
              experimentLoading={experimentLoading}
            />
          ))}
        </div>
      )}

      {/* History timeline */}
      {history && (history.summary as { total_runs?: number })?.total_runs !== undefined &&
        ((history.summary as { total_runs: number }).total_runs > 0) && (
        <div className="mt-6">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-2 text-sm text-compass-muted hover:text-compass-text transition-colors mb-3"
          >
            {historyExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Clock className="w-4 h-4" />
            Discovery History ({(history.summary as { total_runs: number }).total_runs} runs)
          </button>
          {historyExpanded && (
            <div className="space-y-2 pl-6 border-l-2 border-compass-border">
              {history.runs.slice().reverse().slice(0, 10).map((run, i) => (
                <div key={i} className="rounded-lg bg-compass-card border border-compass-border p-3">
                  <div className="flex items-center gap-2 text-xs text-compass-muted mb-1.5">
                    <span>{new Date(run.timestamp as string).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{(run as { opportunity_count?: number }).opportunity_count ?? 0} opportunities</span>
                    <span>·</span>
                    <span>{(run as { conflict_count?: number }).conflict_count ?? 0} conflicts</span>
                    {(run as { prompt_version?: string }).prompt_version && (
                      <>
                        <span>·</span>
                        <span className="font-mono">{(run as { prompt_version?: string }).prompt_version}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((run as { opportunities?: { title: string; confidence: string }[] }).opportunities ?? []).map((opp, j) => (
                      <span
                        key={j}
                        className={clsx(
                          "text-xs px-2 py-0.5 rounded-full",
                          opp.confidence === "high" ? "bg-green-500/15 text-green-400" :
                          opp.confidence === "medium" ? "bg-yellow-500/15 text-yellow-400" :
                          "bg-neutral-500/15 text-neutral-400"
                        )}
                      >
                        {opp.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* Brief slide-over */}
      {activeBrief && (
        <DocumentView
          title={activeBrief.title}
          markdown={activeBrief.markdown}
          onClose={() => setActiveBrief(null)}
        />
      )}

      {/* Update slide-over */}
      {activeUpdate && (
        <DocumentView
          title={activeUpdate.title}
          markdown={activeUpdate.markdown}
          onClose={() => setActiveUpdate(null)}
        />
      )}

      {/* Challenge slide-over */}
      {activeChallenge && (
        <DocumentView
          title={`Challenge: ${activeChallenge.title}`}
          markdown={activeChallenge.markdown}
          onClose={() => setActiveChallenge(null)}
        />
      )}

      {/* Experiment slide-over */}
      {activeExperiment && (
        <DocumentView
          title={`Experiment: ${activeExperiment.title}`}
          markdown={activeExperiment.markdown}
          onClose={() => setActiveExperiment(null)}
        />
      )}
    </div>
  );
}
