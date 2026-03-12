import PieChart from "../charts/PieChart";
import BarChart from "../charts/BarChart";
import AreaChart from "../charts/AreaChart";

interface EvidenceItem {
  id: string;
  source_type: string;
  connector: string;
  title: string;
  metadata?: Record<string, unknown>;
}

interface EvidenceDashboardProps {
  items: EvidenceItem[];
}

export default function EvidenceDashboard({ items }: EvidenceDashboardProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-compass-muted">
        No evidence yet. Ingest sources to see the dashboard.
      </div>
    );
  }

  // By source type
  const typeMap: Record<string, number> = {};
  for (const item of items) {
    typeMap[item.source_type] = (typeMap[item.source_type] || 0) + 1;
  }
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  // By connector
  const connectorMap: Record<string, number> = {};
  for (const item of items) {
    const connector = item.connector || "unknown";
    connectorMap[connector] = (connectorMap[connector] || 0) + 1;
  }
  const connectorData = Object.entries(connectorMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Freshness timeline — group by date if metadata has timestamps
  const dateMap: Record<string, number> = {};
  for (const item of items) {
    const meta = item.metadata || {};
    const dateStr =
      typeof meta.date === "string"
        ? meta.date.slice(0, 10)
        : typeof meta.created_at === "string"
        ? (meta.created_at as string).slice(0, 10)
        : null;
    if (dateStr) {
      dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
    }
  }
  const timelineData = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="rounded-xl bg-compass-card border border-compass-border p-4">
        <PieChart data={typeData} title="By Source Type" height={280} />
      </div>

      <div className="rounded-xl bg-compass-card border border-compass-border p-4">
        <BarChart
          data={connectorData}
          xKey="name"
          yKeys={["count"]}
          title="By Connector"
          height={280}
        />
      </div>

      {timelineData.length > 1 && (
        <div className="md:col-span-2 rounded-xl bg-compass-card border border-compass-border p-4">
          <AreaChart
            data={timelineData}
            xKey="date"
            yKeys={["count"]}
            title="Evidence Freshness"
            height={220}
          />
        </div>
      )}

      <div className="md:col-span-2 rounded-xl bg-compass-card border border-compass-border p-4">
        <h3 className="text-sm font-medium text-compass-text mb-3">Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-semibold text-compass-text">{items.length}</p>
            <p className="text-xs text-compass-muted">Total Evidence</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-compass-text">{Object.keys(typeMap).length}</p>
            <p className="text-xs text-compass-muted">Source Types</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-compass-text">{Object.keys(connectorMap).length}</p>
            <p className="text-xs text-compass-muted">Connectors</p>
          </div>
        </div>
      </div>
    </div>
  );
}
