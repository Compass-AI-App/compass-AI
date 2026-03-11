import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Loader2, ThumbsUp, Star, ThumbsDown } from "lucide-react";
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
  specLoading: boolean;
}

type Rating = "known" | "surprise" | "wrong" | null;

export default function OpportunityCard({ opportunity, onGenerateSpec, specLoading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<Rating>(null);
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);

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
          <div className="flex items-center justify-between">
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
