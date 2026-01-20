import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import "./DecileChart.css";

// Colors for each reform
const REFORM_COLORS = {
  scp_baby_boost: "#5EEAD4",
  scp_inflation: "#2DD4BF",
  income_tax_basic_uplift: "#0D9488",
  income_tax_intermediate_uplift: "#14B8A6",
};

const REFORM_NAMES = {
  scp_baby_boost: "SCP Premium for under-ones",
  scp_inflation: "SCP inflation adjustment",
  income_tax_basic_uplift: "Basic rate +7.4%",
  income_tax_intermediate_uplift: "Intermediate rate +7.4%",
};

/**
 * Stacked decile impact chart showing both reforms by income decile.
 */
export default function StackedDecileChart({
  data,
  title,
  description,
  reforms = ["income_tax_basic_uplift", "income_tax_intermediate_uplift", "scp_inflation", "scp_baby_boost"],
}) {
  const [viewMode, setViewMode] = useState("absolute"); // "relative" or "absolute"

  if (!data || data.length === 0) {
    return (
      <div className="decile-chart">
        <h3 className="chart-title">{title || "Impact by income decile"}</h3>
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  const formatDecile = (value) => value.replace(/st|nd|rd|th/g, "");

  const formatValue = (value) => {
    if (viewMode === "relative") {
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    }
    // Show negative sign for negative values
    if (value < 0) {
      return `-£${Math.abs(value).toFixed(2)}`;
    }
    return `£${value.toFixed(2)}`;
  };

  // Transform data based on view mode
  // Note: relative values are already in percentage format from the calculator
  const chartData = data.map((d) => {
    const row = { decile: d.decile };
    reforms.forEach((reform) => {
      if (viewMode === "relative") {
        row[reform] = d[`${reform}_relative`] || 0;
      } else {
        row[reform] = d[`${reform}_absolute`] || 0;
      }
    });
    return row;
  });

  // Calculate y-axis domain based on stacked totals
  const maxValue = Math.max(
    ...chartData.map((d) =>
      reforms.reduce((sum, reform) => sum + Math.abs(d[reform] || 0), 0)
    )
  );
  const yMax = viewMode === "relative"
    ? Math.max(0.5, Math.ceil(maxValue * 1.2 * 10) / 10)
    : Math.max(5, Math.ceil(maxValue * 1.2));

  return (
    <div className="decile-chart">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">{title || "Impact by income decile"}</h3>
          {description && <p className="chart-description">{description}</p>}
        </div>
      </div>

      <div className="chart-controls">
        <div className="view-toggle">
          <button
            className={viewMode === "relative" ? "active" : ""}
            onClick={() => setViewMode("relative")}
          >
            Relative (%)
          </button>
          <button
            className={viewMode === "absolute" ? "active" : ""}
            onClick={() => setViewMode("absolute")}
          >
            Absolute (£)
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="decile"
            tickFormatter={formatDecile}
            tick={{ fontSize: 12, fill: "#666" }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={formatValue}
            tick={{ fontSize: 12, fill: "#666" }}
            label={{
              value: viewMode === "relative"
                ? "Change in net income (%)"
                : "Change in net income (£)",
              angle: -90,
              position: "insideLeft",
              dx: -20,
              style: {
                textAnchor: "middle",
                fill: "#374151",
                fontSize: 12,
                fontWeight: 500,
              },
            }}
          />
          <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
          <Tooltip
            formatter={(value, name) => [formatValue(value), REFORM_NAMES[name] || name]}
            labelFormatter={(label) => `${label} decile`}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: "#374151", fontSize: "13px" }}>
                {REFORM_NAMES[value] || value}
              </span>
            )}
            wrapperStyle={{
              paddingTop: "20px",
            }}
            iconType="square"
            iconSize={14}
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
          />
          {reforms.map((reform, index) => (
            <Bar
              key={reform}
              dataKey={reform}
              stackId="reforms"
              fill={REFORM_COLORS[reform]}
              radius={index === reforms.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              name={reform}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <p className="chart-note">
        Decile 1 = lowest income households, Decile 10 = highest income households.
        {viewMode === "relative"
          ? " Values show percentage change in household net income."
          : " Values show average £ change per household."}
      </p>
    </div>
  );
}
