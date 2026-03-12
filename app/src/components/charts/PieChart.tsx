import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_THEME, getColor } from "./ChartTheme";

interface PieChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: number;
  showLegend?: boolean;
}

export default function PieChart({
  data,
  title,
  height = 300,
  showLegend = true,
}: PieChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm" style={{ color: CHART_THEME.emptyText }}>
          No data available
        </p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="text-sm font-medium text-compass-text mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={{ stroke: CHART_THEME.textColor }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={getColor(i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: 8,
              color: CHART_THEME.tooltipText,
              fontSize: 12,
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: CHART_THEME.textColor }}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
