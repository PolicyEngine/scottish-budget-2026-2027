import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import "./DecileChart.css";
import { POLICY_COLORS, ALL_POLICY_NAMES, REVENUE_POLICIES, POLICY_NAMES } from "../utils/policyConfig";

// Custom label component for net change values
const NetChangeLabel = ({ x, y, value, viewMode }) => {
  if (value === undefined || value === null) return null;

  const formattedValue = viewMode === "relative"
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
    : (value < 0 ? `-£${Math.abs(value).toFixed(0)}` : `+£${value.toFixed(0)}`);

  const yOffset = value >= 0 ? -18 : 22;

  return (
    <g>
      <rect
        x={x - 28}
        y={y + yOffset - 9}
        width={56}
        height={16}
        fill="white"
        rx={3}
        ry={3}
        stroke="#000000"
        strokeWidth={1}
      />
      <text
        x={x}
        y={y + yOffset}
        fill="#000000"
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {formattedValue}
      </text>
    </g>
  );
};

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
  fixedYAxisDomain = null,
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
    // Show negative sign for negative values
    if (value < 0) {
      return `-£${Math.abs(value).toFixed(2)}`;
    }
    return `£${value.toFixed(2)}`;
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

  // All selected policies for legend (show all selected, even with zero data)
  const legendPolicies = stacked
    ? ALL_POLICY_NAMES.filter(name => selectedPolicyNames.includes(name))
    : [];

  // Policies with actual data for rendering bars
  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        chartData.some(d => Math.abs(d[name] || 0) > 0.001) &&
        selectedPolicyNames.includes(name)
      )
    : [];

  // Show net change line when multiple policies are active
  const showNetChange = stacked && activePolicies.length > 1;

  // Calculate symmetric y-axis domain with round number increments
  const calculateSymmetricDomain = () => {
    let minSum = 0, maxSum = 0;
    if (stacked) {
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
    } else {
      const values = chartData.map(d => d.value || 0);
      maxSum = Math.max(...values, 0);
      minSum = Math.min(...values, 0);
    }

    // Find the max absolute value and round up to nice number for symmetric axis
    const maxAbs = Math.max(Math.abs(minSum), Math.abs(maxSum));

    if (viewMode === "relative") {
      // For percentages: use intervals of 0.5, 1, or 2
      const interval = maxAbs <= 1 ? 0.5 : maxAbs <= 3 ? 1 : 2;
      const roundedMax = Math.ceil((maxAbs * 1.1) / interval) * interval;
      return [-roundedMax, roundedMax];
    } else {
      // For absolute £: use intervals of 10, 20, or 50
      const interval = maxAbs <= 50 ? 10 : maxAbs <= 100 ? 20 : 50;
      const roundedMax = Math.ceil((maxAbs * 1.1) / interval) * interval || 40;
      return [-roundedMax, roundedMax];
    }
  };

  // Generate symmetric ticks including 0
  const generateTicks = (domain) => {
    const [min, max] = domain;
    const range = max - min;
    let interval;
    if (viewMode === "relative") {
      interval = range <= 2 ? 0.5 : range <= 6 ? 1 : 2;
    } else {
      interval = range <= 100 ? 10 : range <= 200 ? 20 : 50;
    }
    const ticks = [];
    for (let i = min; i <= max + 0.001; i += interval) {
      ticks.push(Math.round(i * 100) / 100); // Avoid floating point issues
    }
    return ticks;
  };

  // Use fixed domain if provided (for consistent axis across years), otherwise calculate
  const [yMin, yMax] = fixedYAxisDomain
    ? (viewMode === "relative" ? fixedYAxisDomain.relative : fixedYAxisDomain.absolute)
    : calculateSymmetricDomain();
  const yTicks = generateTicks([yMin, yMax]);

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
            ticks={yTicks}
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
          {stacked && (
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              payload={[
                ...legendPolicies.map((name) => ({
                  value: name,
                  type: "rect",
                  color: POLICY_COLORS[name],
                })),
                ...(showNetChange
                  ? [{ value: "Net change", type: "line", color: "#000000" }]
                  : []),
              ]}
            />
          )}
          <Tooltip
            formatter={(value, name) => [
              formatValue(value),
              name === "Net change" ? "Net change" : name
            ]}
            labelFormatter={(label) => `${label} decile`}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          />
          {stacked ? (
            activePolicies.map((policyName) => (
              <Bar
                key={policyName}
                dataKey={policyName}
                fill={POLICY_COLORS[policyName]}
                name={policyName}
                stackId="stack"
              />
            ))
          ) : (
            <Bar
              dataKey="value"
              fill="#319795"
              radius={[4, 4, 0, 0]}
              stroke="none"
              name="Change"
            />
          )}

          {/* Net change line with dots only */}
          {showNetChange && (
            <Line
              type="monotone"
              dataKey="netChange"
              stroke="#000000"
              strokeWidth={2}
              dot={{ fill: "#000000", stroke: "#000000", strokeWidth: 1, r: 4 }}
              name="Net change"
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
