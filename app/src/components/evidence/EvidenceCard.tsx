import { useState } from "react";
import { ChevronDown, ChevronRight, Code2, FileText, BarChart3, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import type { Evidence, SourceType } from "../../types/engine";

const sourceIcons: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  code: Code2,
  docs: FileText,
  data: BarChart3,
  judgment: MessageSquare,
};

const sourceColors: Record<SourceType, { text: string; bg: string }> = {
  code: { text: "text-compass-code", bg: "bg-compass-code/10" },
  docs: { text: "text-compass-docs", bg: "bg-compass-docs/10" },
  data: { text: "text-compass-data", bg: "bg-compass-data/10" },
  judgment: { text: "text-compass-judgment", bg: "bg-compass-judgment/10" },
};

export default function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = sourceIcons[evidence.source_type] || FileText;
  const colors = sourceColors[evidence.source_type];

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded-xl bg-compass-card border border-compass-border p-4 hover:border-compass-accent/20 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={clsx("p-1.5 rounded-md mt-0.5 shrink-0", colors.bg)}>
          <Icon className={clsx("w-4 h-4", colors.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-compass-text truncate">
              {evidence.title}
            </span>
            <span className={clsx("text-xs px-1.5 py-0.5 rounded-full", colors.bg, colors.text)}>
              {evidence.source_type}
            </span>
          </div>
          <p className="text-xs text-compass-muted mb-1">{evidence.connector}</p>
          <p className="text-sm text-neutral-400 line-clamp-2">
            {expanded ? evidence.content : evidence.content.slice(0, 150)}
            {!expanded && evidence.content.length > 150 && "..."}
          </p>
          {expanded && evidence.content.length > 150 && (
            <pre className="mt-2 text-xs text-neutral-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {evidence.content}
            </pre>
          )}
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
  );
}
