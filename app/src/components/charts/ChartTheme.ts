/**
 * Shared chart theme tokens for Recharts components.
 * Matches the Compass dark theme design system.
 */

export const CHART_COLORS = [
  "#6366f1", // indigo (primary accent)
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f87171", // red
  "#60a5fa", // blue
  "#c084fc", // purple
  "#fb923c", // orange
];

export const CHART_THEME = {
  backgroundColor: "transparent",
  textColor: "#a1a1aa",       // compass-muted (zinc-400)
  gridColor: "#27272a",       // compass-border (zinc-800)
  tooltipBg: "#18181b",       // zinc-900
  tooltipBorder: "#3f3f46",   // zinc-700
  tooltipText: "#e4e4e7",     // zinc-200
  axisColor: "#52525b",       // zinc-600
  emptyText: "#71717a",       // zinc-500
};

export function getColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
