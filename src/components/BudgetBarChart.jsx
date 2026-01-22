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
  LabelList,
} from "recharts";
import "./BudgetBarChart.css";
import { POLICY_COLORS, ALL_POLICY_NAMES, POLICY_NAMES } from "../utils/policyConfig";

// Custom label component for net impact values
const NetImpactLabel = (props) => {
  const { x, y, value } = props;
  if (value === undefined || value === null) return null;

  const formattedValue =
    value < 0 ? `-£${Math.abs(value).toFixed(0)}m` : `+£${value.toFixed(0)}m`;
  const yOffset = value >= 0 ? -20 : 28;

  return (
    <g>
      {/* White background for readability */}
      <rect
        x={x - 32}
        y={y + yOffset - 10}
        width={64}
        height={18}
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
        fontSize={12}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {formattedValue}
      </text>
    </g>
  );
};

export default function BudgetBarChart({ data, title, description, stacked = false, selectedPolicies = [] }) {
  if (!data || data.length === 0) {
    return <div className="budget-bar-chart">No data available</div>;
  }

  const formatValue = (value) => {
    if (value === 0) return "£0m";
    return value < 0 ? `-£${Math.abs(value).toFixed(0)}m` : `£${value.toFixed(0)}m`;
  };

  const formatYear = (year) => `${year}–${String(year + 1).slice(-2)}`;

  // Convert selected policy IDs to names
  const selectedPolicyNames = selectedPolicies.map(id => POLICY_NAMES[id]);

  // Check which policies have non-zero values AND are selected
  const hasNonZeroValues = (policyName) => {
    return data.some((d) => Math.abs(d[policyName] || 0) > 0.001);
  };

  const activePolicies = stacked
    ? ALL_POLICY_NAMES.filter(name =>
        hasNonZeroValues(name) && selectedPolicyNames.includes(name)
      )
    : ALL_POLICY_NAMES.filter(hasNonZeroValues);

  // Check if we should show net impact line (only when multiple policies have data)
  const showNetImpact = stacked && activePolicies.length > 1;

  // Calculate symmetric Y-axis domain with round number increments
  const calculateYAxisConfig = () => {
    let minVal = 0, maxVal = 0;
    data.forEach(d => {
      let negSum = 0, posSum = 0;
      activePolicies.forEach(name => {
        const val = d[name] || 0;
        if (val < 0) negSum += val;
        else posSum += val;
      });
      minVal = Math.min(minVal, negSum);
      maxVal = Math.max(maxVal, posSum);
    });

    // Find the max absolute value
    const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal));

    // Choose a nice round interval based on data range
    let interval;
    if (maxAbs <= 100) interval = 50;
    else if (maxAbs <= 200) interval = 50;
    else if (maxAbs <= 400) interval = 100;
    else interval = 150;

    // Round up to nice number for symmetric axis
    const roundedMax = Math.ceil((maxAbs * 1.1) / interval) * interval || interval;

    // Generate ticks from -roundedMax to +roundedMax, always including 0
    const ticks = [];
    for (let i = -roundedMax; i <= roundedMax; i += interval) {
      ticks.push(i);
    }

    return {
      domain: [-roundedMax, roundedMax],
      ticks: ticks
    };
  };

  const yAxisConfig = stacked ? calculateYAxisConfig() : { domain: ['auto', 'auto'], ticks: undefined };
  const yDomain = yAxisConfig.domain;
  const yTicks = yAxisConfig.ticks;

  return (
    <div className="budget-bar-chart">
      {title && <h3 className="chart-title">{title}</h3>}
      {description && <p className="chart-description">{description}</p>}

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
          stackOffset="sign"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            tickFormatter={formatYear}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name) => [
              formatValue(value),
              name === "Net impact" ? "Net impact" : name
            ]}
            labelFormatter={formatYear}
          />
          {stacked && (
            <Legend
              payload={[
                ...activePolicies.map((name) => ({
                  value: name,
                  type: "rect",
                  color: POLICY_COLORS[name],
                })),
                ...(showNetImpact
                  ? [{ value: "Net impact", type: "line", color: "#000000" }]
                  : []),
              ]}
            />
          )}
          <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />

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
              fill="#0D9488"
              name="Impact"
            />
          )}

          {/* Net impact line with dots and labels */}
          {showNetImpact && (
            <Line
              type="monotone"
              dataKey="netImpact"
              stroke="#000000"
              strokeWidth={2}
              dot={{ fill: "#000000", stroke: "#000000", strokeWidth: 1, r: 4 }}
              name="Net impact"
              label={<NetImpactLabel />}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
