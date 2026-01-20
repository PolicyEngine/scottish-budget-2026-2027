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
import "./BudgetBarChart.css";
import { POLICY_COLORS, POLICY_NAMES, ALL_POLICY_NAMES, ALL_POLICY_IDS } from "../utils/policyConfig";

/**
 * Bar chart showing values by year, with stacking support for multiple policies.
 * Uses sign convention: negative = cost to government, positive = revenue.
 * Costs shown below axis (teal), revenue shown above axis (amber).
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
  yMaxValue = null,
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

  const defaultFormat = (value) => {
    const absVal = Math.abs(value).toFixed(0);
    return value < 0 ? `-£${absVal}m` : `£${absVal}m`;
  };
  const formatValue = yFormat || defaultFormat;
  const formatYearRange = (year) => `${year}–${(year + 1).toString().slice(-2)}`;

  // Convert selected policy IDs to names
  const selectedPolicyNames = selectedPolicies.map(id => POLICY_NAMES[id]);

  // Check which policies have non-zero data AND are selected
  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        data.some(d => Math.abs(d[name] || 0) > 0.001) &&
        selectedPolicyNames.includes(name)
      )
    : [];

  // Calculate y-axis domain based on data - symmetric around zero
  let yMin = 0, yMax = 10;
  if (stacked) {
    // For stacked with positive/negative, find min and max (only for active policies)
    let minSum = 0, maxSum = 0;
    data.forEach(d => {
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
    const rounded = Math.ceil(absMax / 100) * 100;
    yMin = -rounded;
    yMax = yMaxValue || rounded;
  } else {
    const values = data.map(d => d.value || 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    // Make symmetric around zero if there are negative values
    if (minVal < 0) {
      const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
      const rounded = Math.ceil(absMax / 10) * 10;
      yMin = -rounded;
      yMax = yMaxValue || rounded;
    } else {
      yMin = 0;
      yMax = yMaxValue || Math.ceil(maxVal / 10) * 10;
    }
  }

  return (
    <div className="budget-bar-chart">
      {title && <h3 className="chart-title">{title}</h3>}
      {description && <p className="chart-description">{description}</p>}

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
          data={data}
          margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
          stackOffset="sign"
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
            ticks={(() => {
              const range = yMax - yMin;
              let interval = 200;
              if (range > 2000) interval = 400;
              if (range > 4000) interval = 500;
              const ticks = [];
              for (let i = yMin; i <= yMax + 0.001; i += interval) {
                ticks.push(Math.round(i));
              }
              if (!ticks.includes(0)) ticks.push(0);
              return ticks.sort((a, b) => a - b);
            })()}
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
          <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
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
              name={tooltipLabel}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
