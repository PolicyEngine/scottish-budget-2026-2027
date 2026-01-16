import { useState } from "react";
import {
  ComposedChart,
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
  const [viewMode, setViewMode] = useState("absolute"); // "absolute" or "relative"
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
  // Note: relative values are already in percentage format from the calculator
  let chartData;
  if (stacked && stackedData) {
    chartData = stackedData.map((d) => {
      const point = { decile: d.decile };
      ALL_POLICY_NAMES.forEach(name => {
        if (viewMode === "relative") {
          point[name] = d[`${name}_relative`] || 0;
        } else {
          point[name] = d[`${name}_absolute`] || 0;
        }
      });
      point.netChange = viewMode === "relative"
        ? (d.netRelative || 0)
        : (d.netAbsolute || 0);
      return point;
    });
  } else {
    chartData = data.map((d) => ({
      decile: d.decile,
      value: viewMode === "relative" ? d.relativeChange : d.absoluteChange,
    }));
  }

  // Check which policies have data
  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        chartData.some(d => Math.abs(d[name] || 0) > 0.001)
      )
    : [];

  // Calculate y-axis domain with equal increments
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

  // Calculate nice round numbers for equal increments
  const getNiceMax = (val) => {
    if (val <= 0) return viewMode === "relative" ? 0.5 : 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
    const normalized = val / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
  };

  const yMax = viewMode === "relative"
    ? getNiceMax(Math.max(0.5, maxValue * 1.1))
    : 40; // Fixed max for absolute mode

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
            className={viewMode === "absolute" ? "active" : ""}
            onClick={() => setViewMode("absolute")}
          >
            Absolute (£)
          </button>
          <button
            className={viewMode === "relative" ? "active" : ""}
            onClick={() => setViewMode("relative")}
          >
            Relative (%)
          </button>
        </div>
        {onYearChange && (
          <div className="year-toggle">
            {availableYears.map((year) => (
              <button
                key={year}
                className={selectedYear === year ? "active" : ""}
                onClick={() => onYearChange(year)}
              >
                {formatYearRange(year)}
              </button>
            ))}
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
            tickCount={5}
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
              payload={activePolicies.map(name => ({
                value: name,
                type: "rect",
                color: POLICY_COLORS[name],
              }))}
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
                  stroke="none"
                  hide={!activePolicies.includes(policyName)}
                />
              ))}
            </>
          ) : (
            <Bar
              dataKey="value"
              fill="#319795"
              radius={[4, 4, 0, 0]}
              stroke="none"
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
