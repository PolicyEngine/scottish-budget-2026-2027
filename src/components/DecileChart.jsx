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
} from "recharts";
import "./DecileChart.css";
import { POLICY_COLORS, ALL_POLICY_NAMES, REVENUE_POLICIES, POLICY_NAMES } from "../utils/policyConfig";

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
  selectedPolicies = [],
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
    return `£${Math.abs(value).toFixed(2)}`;
  };

  // Get policy IDs that are revenue raisers (bad for households - should be negative)
  const revenuePolicyNames = REVENUE_POLICIES.map(id => POLICY_NAMES[id]);

  // Prepare chart data
  // Note: relative values are already in percentage format from the calculator
  // Revenue policies (freezes) should be negative as they reduce household income
  let chartData;
  if (stacked && stackedData) {
    chartData = stackedData.map((d) => {
      const point = { decile: d.decile };
      ALL_POLICY_NAMES.forEach(name => {
        let value;
        if (viewMode === "relative") {
          value = d[`${name}_relative`] || 0;
        } else {
          value = d[`${name}_absolute`] || 0;
        }
        // Negate revenue policy values (they're costs to households)
        if (revenuePolicyNames.includes(name)) {
          value = -Math.abs(value);
        }
        point[name] = value;
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

  // Convert selected policy IDs to names
  const selectedPolicyNames = selectedPolicies.map(id => POLICY_NAMES[id]);

  // Check which policies have data AND are selected
  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        chartData.some(d => Math.abs(d[name] || 0) > 0.001) &&
        selectedPolicyNames.includes(name)
      )
    : [];

  // Calculate y-axis domain - symmetric around zero for stacked charts (only for active policies)
  let yMin = 0, yMax = 10;
  if (stacked) {
    let minSum = 0, maxSum = 0;
    chartData.forEach(d => {
      let positiveSum = 0, negativeSum = 0;
      activePolicies.forEach(name => {
        const val = d[name] || 0;
        if (val > 0) positiveSum += val;
        else negativeSum += val;
      });
      minSum = Math.min(minSum, negativeSum);
      maxSum = Math.max(maxSum, positiveSum);
    });
    // Make symmetric around zero
    const absMax = Math.max(Math.abs(minSum), Math.abs(maxSum));
    if (viewMode === "relative") {
      const rounded = Math.ceil(absMax * 10) / 10;
      yMin = -rounded;
      yMax = rounded;
    } else {
      const rounded = Math.ceil(absMax / 20) * 20;
      yMin = -rounded;
      yMax = rounded || 40;
    }
  } else {
    const values = chartData.map(d => d.value || 0);
    const maxVal = Math.max(...values);
    yMin = 0;
    yMax = viewMode === "relative"
      ? Math.ceil(maxVal * 10) / 10
      : Math.max(40, Math.ceil(maxVal / 10) * 10);
  }

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

      {/* Custom legend showing only active policies */}
      {stacked && activePolicies.length > 0 && (
        <div className="custom-legend" style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "16px",
          marginBottom: "12px",
          maxWidth: "800px",
          margin: "0 auto 12px auto"
        }}>
          {activePolicies.map(name => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "12px",
                height: "12px",
                backgroundColor: POLICY_COLORS[name],
                display: "inline-block"
              }}></span>
              <span style={{ fontSize: "13px", color: "#374151" }}>{name}</span>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
          stackOffset="sign"
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
            domain={[yMin, yMax]}
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
                  legendType="none"
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
