import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_THEME, getColor } from "./ChartTheme";

interface RadarChartProps {
  data: Record<string, unknown>[];
  angleKey: string;
  dataKeys: string[];
  title?: string;
  height?: number;
}

export default function RadarChart({
  data,
  angleKey,
  dataKeys,
  title,
  height = 300,
}: RadarChartProps) {
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
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={CHART_THEME.gridColor} />
          <PolarAngleAxis
            dataKey={angleKey}
            tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
          />
          <PolarRadiusAxis
            tick={{ fill: CHART_THEME.textColor, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisColor }}
          />
          {dataKeys.map((key, i) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={getColor(i)}
              fill={getColor(i)}
              fillOpacity={0.2}
            />
          ))}
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: 8,
              color: CHART_THEME.tooltipText,
              fontSize: 12,
            }}
          />
          {dataKeys.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: CHART_THEME.textColor }}
            />
          )}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
