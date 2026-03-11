import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Database, FileCode2, FileText, FlaskConical, Loader2, ShieldAlert, ThumbsUp, Star, ThumbsDown } from "lucide-react";
import { clsx } from "clsx";
import type { Opportunity, Confidence } from "../../types/engine";
import { useWorkspaceStore } from "../../stores/workspace";

const confidenceStyles: Record<Confidence, string> = {
  high: "bg-green-500/15 text-green-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-neutral-500/15 text-neutral-400",
};

interface Props {
  opportunity: Opportunity;
  onGenerateSpec: (title: string) => void;
  onGenerateBrief: (title: string) => void;
  onChallenge: (title: string) => void;
  onDesignExperiment: (title: string) => void;
  specLoading: boolean;
  briefLoading: boolean;
  challengeLoading: boolean;
  experimentLoading: boolean;
}

type Rating = "known" | "surprise" | "wrong" | null;

export default function OpportunityCard({ opportunity, onGenerateSpec, onGenerateBrief, onChallenge, onDesignExperiment, specLoading, briefLoading, challengeLoading, experimentLoading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<Rating>(null);
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const navigate = useNavigate();

  async function handleRate(r: Rating) {
    if (!r || !workspacePath) return;
    setRating(r);
    try {
      await window.compass?.engine.call("/feedback", {
        workspace_path: workspacePath,
        opportunity_title: opportunity.title,
        rating: r,
      });
    } catch {
      // silently ignore
    }
  }

  return (
    <div className="rounded-xl bg-compass-card border border-compass-border p-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-compass-accent/10 flex items-center justify-center shrink-0 text-compass-accent text-sm font-bold">
            #{opportunity.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-medium text-compass-text">{opportunity.title}</h3>
              <span
                className={clsx(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  confidenceStyles[opportunity.confidence]
                )}
              >
                {opportunity.confidence}
              </span>
            </div>
            <p className="text-sm text-neutral-400 line-clamp-2">{opportunity.description}</p>
          </div>
          <div className="shrink-0 text-compass-muted mt-1">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-compass-border space-y-3">
          {opportunity.evidence_summary && (
            <div>
              <p className="text-xs font-medium text-compass-muted mb-1">Evidence Summary</p>
              <p className="text-sm text-neutral-400">{opportunity.evidence_summary}</p>
            </div>
          )}
          {opportunity.estimated_impact && (
            <div>
              <p className="text-xs font-medium text-compass-muted mb-1">Estimated Impact</p>
              <p className="text-sm text-neutral-400">{opportunity.estimated_impact}</p>
            </div>
          )}
          {opportunity.evidence_ids && opportunity.evidence_ids.length > 0 && (
            <div>
              <p className="text-xs font-medium text-compass-muted mb-1.5 flex items-center gap-1">
                <Database className="w-3 h-3" /> Linked Evidence
              </p>
              <div className="flex flex-wrap gap-1.5">
                {opportunity.evidence_ids.map((eid) => (
                  <button
                    key={eid}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/evidence?id=${eid}`);
                    }}
                    className="text-xs px-2 py-1 rounded-md bg-compass-accent/10 text-compass-accent hover:bg-compass-accent/20 transition-colors font-mono"
                    title={`View evidence: ${eid}`}
                  >
                    {eid.slice(0, 12)}...
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateSpec(opportunity.title);
                }}
                disabled={specLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-compass-accent hover:bg-compass-accent-hover text-white text-sm font-medium transition-colors"
              >
                {specLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCode2 className="w-4 h-4" />
                )}
                Generate Spec
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateBrief(opportunity.title);
                }}
                disabled={briefLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-compass-border text-compass-muted hover:text-compass-text hover:border-compass-text/30 text-sm font-medium transition-colors"
              >
                {briefLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Write Brief
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChallenge(opportunity.title);
                }}
                disabled={challengeLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400/70 hover:text-red-400 hover:border-red-500/50 text-sm font-medium transition-colors"
              >
                {challengeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                Challenge
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDesignExperiment(opportunity.title);
                }}
                disabled={experimentLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 text-purple-400/70 hover:text-purple-400 hover:border-purple-500/50 text-sm font-medium transition-colors"
              >
                {experimentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FlaskConical className="w-4 h-4" />
                )}
                Experiment
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-compass-muted mr-1">Rate:</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate("known"); }}
                className={clsx(
                  "p-1.5 rounded-md transition-colors",
                  rating === "known" ? "bg-neutral-500/20 text-neutral-300" : "text-neutral-600 hover:text-neutral-400"
                )}
                title="Already knew this"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate("surprise"); }}
                className={clsx(
                  "p-1.5 rounded-md transition-colors",
                  rating === "surprise" ? "bg-yellow-500/20 text-yellow-400" : "text-neutral-600 hover:text-yellow-400/60"
                )}
                title="New insight!"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate("wrong"); }}
                className={clsx(
                  "p-1.5 rounded-md transition-colors",
                  rating === "wrong" ? "bg-red-500/20 text-red-400" : "text-neutral-600 hover:text-red-400/60"
                )}
                title="Wrong / inaccurate"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
