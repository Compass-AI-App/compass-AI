import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { Opportunity, Confidence } from "../../types/engine";

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

export default function OpportunityCard({ opportunity, onGenerateSpec, specLoading }: Props) {
  const [expanded, setExpanded] = useState(false);

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
        </div>
      )}
    </div>
  );
}
