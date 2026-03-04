import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import type { Conflict, ConflictSeverity } from "../../types/engine";

const severityStyles: Record<ConflictSeverity, { badge: string; border: string }> = {
  high: { badge: "bg-red-500/15 text-red-400 border-red-500/30", border: "border-red-500/20" },
  medium: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", border: "border-amber-500/20" },
  low: { badge: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30", border: "border-compass-border" },
};

const typeLabels: Record<string, string> = {
  code_vs_docs: "Code vs Docs",
  code_vs_data: "Code vs Data",
  code_vs_judgment: "Code vs Judgment",
  docs_vs_data: "Docs vs Data",
  docs_vs_judgment: "Docs vs Judgment",
  data_vs_judgment: "Data vs Judgment",
};

export default function ConflictCard({ conflict }: { conflict: Conflict }) {
  const [expanded, setExpanded] = useState(false);
  const styles = severityStyles[conflict.severity];

  return (
    <div
      className={clsx(
        "rounded-xl bg-compass-card border p-4 transition-colors",
        styles.border
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={clsx(
                  "text-xs px-2 py-0.5 rounded-full border font-medium uppercase",
                  styles.badge
                )}
              >
                {conflict.severity}
              </span>
              <span className="text-xs text-compass-muted">
                {typeLabels[conflict.conflict_type] || conflict.conflict_type}
              </span>
            </div>
            <h3 className="text-sm font-medium text-compass-text mb-1">{conflict.title}</h3>
            <p className="text-sm text-neutral-400 line-clamp-2">{conflict.description}</p>
          </div>
          <div className="shrink-0 text-compass-muted mt-1">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-compass-border space-y-3">
          {conflict.source_a_evidence.length > 0 && (
            <div>
              <p className="text-xs font-medium text-compass-muted mb-1">Source A Evidence</p>
              <ul className="space-y-0.5">
                {conflict.source_a_evidence.map((e, i) => (
                  <li key={i} className="text-xs text-neutral-400">{e}</li>
                ))}
              </ul>
            </div>
          )}
          {conflict.source_b_evidence.length > 0 && (
            <div>
              <p className="text-xs font-medium text-compass-muted mb-1">Source B Evidence</p>
              <ul className="space-y-0.5">
                {conflict.source_b_evidence.map((e, i) => (
                  <li key={i} className="text-xs text-neutral-400">{e}</li>
                ))}
              </ul>
            </div>
          )}
          {conflict.recommendation && (
            <div className="rounded-lg bg-compass-accent/5 border border-compass-accent/20 p-3">
              <p className="text-xs font-medium text-compass-accent mb-1">Recommendation</p>
              <p className="text-sm text-neutral-300">{conflict.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
