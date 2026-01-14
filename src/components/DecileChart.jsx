import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import "./DecileChart.css";
import { POLICY_COLORS, ALL_POLICY_NAMES } from "../utils/policyConfig";

/**
 * Decile impact chart showing relative or absolute change by income decile.
 * Supports stacked bars when multiple policies are selected.
 */
export default function DecileChart({
  data,
  title,
  description,
  stacked = false,
  stackedData = null,
  selectedYear = 2026,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
}) {
  const [viewMode, setViewMode] = useState("relative"); // "relative" or "absolute"
  const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;

  const effectiveData = stacked && stackedData ? stackedData : data;

  if (!effectiveData || effectiveData.length === 0) {
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
    return `£${Math.abs(value).toLocaleString("en-GB")}`;
  };

  // Prepare chart data
  let chartData;
  if (stacked && stackedData) {
    chartData = stackedData.map((d) => {
      const point = { decile: d.decile };
      ALL_POLICY_NAMES.forEach(name => {
        if (viewMode === "relative") {
          point[name] = (d[`${name}_relative`] || 0) * 100;
        } else {
          point[name] = d[`${name}_absolute`] || 0;
        }
      });
      point.netChange = viewMode === "relative"
        ? (d.netRelative || 0) * 100
        : (d.netAbsolute || 0);
      return point;
    });
  } else {
    chartData = data.map((d) => ({
      decile: d.decile,
      value: viewMode === "relative" ? d.relativeChange * 100 : d.absoluteChange,
    }));
  }

  // Check which policies have data
  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        chartData.some(d => Math.abs(d[name] || 0) > 0.001)
      )
    : [];

  // Calculate y-axis domain with sensible ranges
  let maxValue;
  if (stacked) {
    maxValue = Math.max(...chartData.map((d) => {
      let sum = 0;
      ALL_POLICY_NAMES.forEach(name => { sum += Math.abs(d[name] || 0); });
      return sum || Math.abs(d.netChange || 0);
    }));
  } else {
    maxValue = Math.max(...chartData.map((d) => Math.abs(d.value || 0)));
  }
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
        {onYearChange && (
          <div className="year-selector">
            <label>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {formatYearRange(year)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
          stackOffset={stacked ? "sign" : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="decile"
            tickFormatter={formatDecile}
            tick={{ fontSize: 12, fill: "#666" }}
            label={{
              value: "Income decile",
              position: "insideBottom",
              offset: -10,
              style: { fill: "#374151", fontSize: 12, fontWeight: 500 },
            }}
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
            formatter={(value, name) => [formatValue(value), name]}
            labelFormatter={(label) => `${label} decile`}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          />
          {stacked && activePolicies.length > 1 && (
            <Legend
              verticalAlign="top"
              height={36}
              payload={[
                ...activePolicies.map(name => ({
                  value: name,
                  type: "rect",
                  color: POLICY_COLORS[name],
                })),
                { value: "Net change", type: "line", color: "#000000" },
              ]}
            />
          )}
          {stacked ? (
            <>
              {ALL_POLICY_NAMES.map((policyName) => (
                <Bar
                  key={policyName}
                  dataKey={policyName}
                  fill={POLICY_COLORS[policyName]}
                  name={policyName}
                  stackId="stack"
                  radius={[2, 2, 0, 0]}
                  hide={!activePolicies.includes(policyName)}
                />
              ))}
              {activePolicies.length > 1 && (
                <Line
                  type="monotone"
                  dataKey="netChange"
                  stroke="#000000"
                  strokeWidth={2}
                  dot={{ fill: "#000000", r: 4 }}
                  name="Net change"
                />
              )}
            </>
          ) : (
            <Bar
              dataKey="value"
              fill="#319795"
              radius={[4, 4, 0, 0]}
              name="Change"
            />
          )}
        </ComposedChart>
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
