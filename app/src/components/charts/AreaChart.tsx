import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_THEME, getColor } from "./ChartTheme";

interface AreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  title?: string;
  height?: number;
  stacked?: boolean;
}

export default function AreaChart({
  data,
  xKey,
  yKeys,
  title,
  height = 300,
  stacked = false,
}: AreaChartProps) {
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
        <RechartsAreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
            axisLine={{ stroke: CHART_THEME.axisColor }}
            tickLine={{ stroke: CHART_THEME.axisColor }}
          />
          <YAxis
            tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
            axisLine={{ stroke: CHART_THEME.axisColor }}
            tickLine={{ stroke: CHART_THEME.axisColor }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: 8,
              color: CHART_THEME.tooltipText,
              fontSize: 12,
            }}
          />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: CHART_THEME.textColor }} />}
          {yKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getColor(i)}
              fill={getColor(i)}
              fillOpacity={0.15}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
