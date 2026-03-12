import { clsx } from "clsx";
import type { Conflict, ConflictType, ConflictSeverity } from "../../types/engine";

interface ConflictMatrixProps {
  conflicts: Conflict[];
}

const SOURCE_LABELS = ["Code", "Docs", "Data", "Judgment"];

const SOURCE_PAIRS: { type: ConflictType; row: number; col: number }[] = [
  { type: "code_vs_docs", row: 0, col: 1 },
  { type: "code_vs_data", row: 0, col: 2 },
  { type: "code_vs_judgment", row: 0, col: 3 },
  { type: "docs_vs_data", row: 1, col: 2 },
  { type: "docs_vs_judgment", row: 1, col: 3 },
  { type: "data_vs_judgment", row: 2, col: 3 },
];

const severityColors: Record<ConflictSeverity, string> = {
  high: "bg-red-500/70 text-white",
  medium: "bg-amber-500/60 text-white",
  low: "bg-neutral-500/40 text-neutral-200",
};

const severityBg: Record<ConflictSeverity, string> = {
  high: "bg-red-500/15",
  medium: "bg-amber-500/10",
  low: "bg-neutral-500/5",
};

function worstSeverity(severities: ConflictSeverity[]): ConflictSeverity | null {
  if (severities.includes("high")) return "high";
  if (severities.includes("medium")) return "medium";
  if (severities.includes("low")) return "low";
  return null;
}

export default function ConflictMatrix({ conflicts }: ConflictMatrixProps) {
  if (conflicts.length === 0) {
    return (
      <div className="text-center py-12 text-compass-muted">
        No conflicts to display. Run reconciliation first.
      </div>
    );
  }

  // Group conflicts by type
  const byType: Record<string, Conflict[]> = {};
  for (const c of conflicts) {
    if (!byType[c.conflict_type]) byType[c.conflict_type] = [];
    byType[c.conflict_type].push(c);
  }

  // Build matrix data
  const matrix: (null | { count: number; severity: ConflictSeverity })[][] = Array.from(
    { length: 4 },
    () => Array(4).fill(null) as null[]
  );

  for (const pair of SOURCE_PAIRS) {
    const items = byType[pair.type] || [];
    if (items.length > 0) {
      const severity = worstSeverity(items.map((c) => c.severity))!;
      matrix[pair.row][pair.col] = { count: items.length, severity };
      matrix[pair.col][pair.row] = { count: items.length, severity };
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-compass-text mb-3">Conflict Severity Matrix</h3>
      <div className="rounded-xl bg-compass-card border border-compass-border p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-20" />
              {SOURCE_LABELS.map((label) => (
                <th
                  key={label}
                  className="text-xs font-medium text-compass-muted text-center px-2 py-2"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOURCE_LABELS.map((rowLabel, rowIdx) => (
              <tr key={rowLabel}>
                <td className="text-xs font-medium text-compass-muted text-right pr-3 py-2">
                  {rowLabel}
                </td>
                {SOURCE_LABELS.map((_, colIdx) => {
                  const cell = matrix[rowIdx][colIdx];
                  const isDiag = rowIdx === colIdx;
                  return (
                    <td key={colIdx} className="text-center px-1 py-1">
                      {isDiag ? (
                        <div className="w-14 h-14 mx-auto rounded-lg bg-compass-border/30" />
                      ) : cell ? (
                        <div
                          className={clsx(
                            "w-14 h-14 mx-auto rounded-lg flex flex-col items-center justify-center gap-0.5",
                            severityBg[cell.severity]
                          )}
                        >
                          <span
                            className={clsx(
                              "text-sm font-bold px-1.5 py-0.5 rounded",
                              severityColors[cell.severity]
                            )}
                          >
                            {cell.count}
                          </span>
                          <span className="text-[10px] text-compass-muted">{cell.severity}</span>
                        </div>
                      ) : (
                        <div className="w-14 h-14 mx-auto rounded-lg bg-green-500/5 flex items-center justify-center">
                          <span className="text-xs text-green-400/60">0</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-compass-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/70" />
          High
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500/60" />
          Medium
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-neutral-500/40" />
          Low
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/20" />
          None
        </div>
      </div>
    </div>
  );
}
