import BarChart from "../charts/BarChart";
import RadarChart from "../charts/RadarChart";
import type { Opportunity } from "../../types/engine";

interface OpportunityChartProps {
  opportunities: Opportunity[];
}

const confidenceScore: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const impactScore: Record<string, number> = {
  high: 3,
  "medium-high": 2.5,
  medium: 2,
  "medium-low": 1.5,
  low: 1,
};

function parseImpact(impact: string): number {
  const lower = impact.toLowerCase();
  for (const [key, val] of Object.entries(impactScore)) {
    if (lower.includes(key)) return val;
  }
  return 2; // default medium
}

export default function OpportunityChart({ opportunities }: OpportunityChartProps) {
  if (opportunities.length === 0) {
    return (
      <div className="text-center py-12 text-compass-muted">
        No opportunities yet. Run discovery to see charts.
      </div>
    );
  }

  // Bar chart: ranking by confidence and evidence count
  const barData = opportunities.map((opp) => ({
    name: opp.title.length > 30 ? opp.title.slice(0, 28) + "..." : opp.title,
    confidence: confidenceScore[opp.confidence] || 2,
    evidence: opp.evidence_ids.length,
  }));

  // Radar chart: multi-dimensional view for top opportunities
  const radarData = [
    { dimension: "Confidence" },
    { dimension: "Impact" },
    { dimension: "Evidence" },
    { dimension: "Conflicts" },
  ] as Record<string, unknown>[];

  const topOpps = opportunities.slice(0, 5);
  for (const opp of topOpps) {
    const key = opp.title.length > 20 ? opp.title.slice(0, 18) + "..." : opp.title;
    radarData[0][key] = confidenceScore[opp.confidence] || 2;
    radarData[1][key] = parseImpact(opp.estimated_impact);
    radarData[2][key] = Math.min(opp.evidence_ids.length, 5);
    radarData[3][key] = Math.min(opp.conflict_ids.length, 3);
  }
  const radarKeys = topOpps.map((opp) =>
    opp.title.length > 20 ? opp.title.slice(0, 18) + "..." : opp.title
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-compass-card border border-compass-border p-4">
        <BarChart
          data={barData}
          xKey="name"
          yKeys={["confidence", "evidence"]}
          title="Opportunities: Confidence & Evidence"
          height={280}
        />
      </div>

      {topOpps.length >= 2 && (
        <div className="rounded-xl bg-compass-card border border-compass-border p-4">
          <RadarChart
            data={radarData}
            angleKey="dimension"
            dataKeys={radarKeys}
            title="Top Opportunities: Multi-dimensional"
            height={320}
          />
        </div>
      )}
    </div>
  );
}
