import { useEffect, useState } from "react";
import { LayoutDashboard, Loader2, Pin, PinOff, Search, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useDashboardStore, type ChartSpec } from "../stores/dashboard";
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";
import PieChart from "../components/charts/PieChart";
import AreaChart from "../components/charts/AreaChart";
import RadarChart from "../components/charts/RadarChart";

function ChartRenderer({ spec }: { spec: ChartSpec }) {
  switch (spec.type) {
    case "pie":
      return (
        <PieChart
          data={spec.data as { name: string; value: number }[]}
          title={spec.title}
          height={260}
        />
      );
    case "line":
      return (
        <LineChart
          data={spec.data}
          xKey={spec.x_key}
          yKeys={spec.y_keys}
          title={spec.title}
          height={260}
        />
      );
    case "area":
      return (
        <AreaChart
          data={spec.data}
          xKey={spec.x_key}
          yKeys={spec.y_keys}
          title={spec.title}
          height={260}
        />
      );
    case "radar":
      return (
        <RadarChart
          data={spec.data}
          angleKey={spec.x_key}
          dataKeys={spec.y_keys}
          title={spec.title}
          height={260}
        />
      );
    default:
      return (
        <BarChart
          data={spec.data}
          xKey={spec.x_key}
          yKeys={spec.y_keys}
          title={spec.title}
          height={260}
        />
      );
  }
}

export default function DashboardPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const { charts, title, loading, error, pinnedCharts, generateDashboard, pinChart, unpinChart, loadPinned } =
    useDashboardStore();
  const [question, setQuestion] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  useEffect(() => {
    loadPinned(workspacePath || "");
  }, [workspacePath]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !workspacePath || loading) return;
    setLastQuery(question.trim());
    generateDashboard(workspacePath, question.trim());
  }

  const isPinned = (chart: ChartSpec) =>
    pinnedCharts.some((p) => p.title === chart.title && p.query === lastQuery);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard className="w-6 h-6 text-compass-accent" />
        <h1 className="text-2xl font-semibold text-compass-text">Dashboard</h1>
      </div>

      {/* Query input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-compass-muted" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your product data..."
            className="w-full pl-10 pr-24 py-3 rounded-lg bg-compass-card border border-compass-border text-sm text-compass-text placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent"
          />
          <button
            type="submit"
            disabled={!question.trim() || !workspacePath || loading}
            className={clsx(
              "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              question.trim() && !loading
                ? "bg-compass-accent text-white hover:bg-compass-accent-hover"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Generate
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-compass-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Analyzing evidence and generating charts...
        </div>
      )}

      {/* Generated charts */}
      {!loading && charts.length > 0 && (
        <div className="mb-8">
          {title && (
            <h2 className="text-lg font-medium text-compass-text mb-4">{title}</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map((chart, i) => (
              <div key={i} className="rounded-xl bg-compass-card border border-compass-border p-4 relative group">
                <ChartRenderer spec={chart} />
                <button
                  onClick={() =>
                    isPinned(chart)
                      ? unpinChart(pinnedCharts.find((p) => p.title === chart.title && p.query === lastQuery)?.id || "")
                      : pinChart(chart, lastQuery)
                  }
                  className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                  title={isPinned(chart) ? "Unpin" : "Pin to dashboard"}
                >
                  {isPinned(chart) ? (
                    <PinOff className="w-3.5 h-3.5 text-compass-accent" />
                  ) : (
                    <Pin className="w-3.5 h-3.5 text-compass-muted" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned charts */}
      {pinnedCharts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-compass-muted mb-3 uppercase tracking-wider">
            Pinned Charts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedCharts.map((chart) => (
              <div key={chart.id} className="rounded-xl bg-compass-card border border-compass-border p-4 relative group">
                <ChartRenderer spec={chart} />
                <p className="text-[10px] text-compass-muted mt-2 truncate">
                  Query: {chart.query}
                </p>
                <button
                  onClick={() => unpinChart(chart.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                  title="Unpin"
                >
                  <X className="w-3.5 h-3.5 text-compass-muted" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && charts.length === 0 && pinnedCharts.length === 0 && (
        <div className="text-center py-16 text-compass-muted">
          <LayoutDashboard className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>Ask a question to generate charts from your evidence.</p>
          <p className="text-xs mt-1">
            e.g., "What are the top customer complaints?" or "Show me evidence distribution by source"
          </p>
        </div>
      )}
    </div>
  );
}
