import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import "./BudgetBarChart.css";
import { POLICY_COLORS, POLICY_NAMES, ALL_POLICY_NAMES } from "../utils/policyConfig";

/**
 * Bar chart showing values by year, with stacking support for multiple policies.
 */
export default function BudgetBarChart({
  data,
  title,
  description,
  yLabel = "Cost (£ millions)",
  yFormat,
  tooltipLabel = "Value",
  stacked = false,
  selectedPolicies = [],
  yMaxValue = 100,
  yTickCount = 6,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="budget-bar-chart">
        {title && <h3 className="chart-title">{title}</h3>}
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  const defaultFormat = (value) => `£${value.toFixed(0)}m`;
  const formatValue = yFormat || defaultFormat;
  const formatYearRange = (year) => `${year}–${(year + 1).toString().slice(-2)}`;

  // Calculate y-axis domain based on stacked or single mode with equal increments
  let maxValue, minValue;
  if (stacked) {
    // For stacked, sum all policy values for max
    maxValue = Math.max(...data.map((d) => {
      let sum = 0;
      ALL_POLICY_NAMES.forEach(name => {
        if (d[name]) sum += Math.abs(d[name]);
      });
      return sum || Math.abs(d.netImpact || 0);
    }));
    minValue = 0;
  } else {
    maxValue = Math.max(...data.map((d) => Math.abs(d.value || 0)));
    minValue = Math.min(...data.map((d) => d.value || 0));
  }

  // Calculate nice round numbers for equal increments
  const getNiceMax = (val) => {
    if (val <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
    const normalized = val / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
  };

  const yMin = minValue < 0 ? -getNiceMax(Math.abs(minValue)) : 0;
  const yMax = yMaxValue;

  // Check which policies have data
  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        data.some(d => Math.abs(d[name] || 0) > 0.001)
      )
    : [];

  return (
    <div className="budget-bar-chart">
      {title && <h3 className="chart-title">{title}</h3>}
      {description && <p className="chart-description">{description}</p>}

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
          stackOffset={stacked ? "sign" : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="year"
            tickFormatter={formatYearRange}
            tick={{ fontSize: 12, fill: "#666" }}
            label={{
              value: "Financial year",
              position: "insideBottom",
              offset: -10,
              style: { fill: "#374151", fontSize: 12, fontWeight: 500 },
            }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={formatValue}
            tick={{ fontSize: 12, fill: "#666" }}
            tickCount={yTickCount}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              dx: -15,
              style: {
                textAnchor: "middle",
                fill: "#374151",
                fontSize: 12,
                fontWeight: 500,
              },
            }}
          />
          <Tooltip
            formatter={(value, name) => [formatValue(value), name]}
            labelFormatter={(label) => formatYearRange(label)}
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
              name={tooltipLabel}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
