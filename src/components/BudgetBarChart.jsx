import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import "./BudgetBarChart.css";
import { POLICY_COLORS, ALL_POLICY_NAMES } from "../utils/policyConfig";

export default function BudgetBarChart({ data, title, description, stacked = false }) {
  if (!data || data.length === 0) {
    return <div className="budget-bar-chart">No data available</div>;
  }

  const formatValue = (value) => {
    if (value === 0) return "£0m";
    return value < 0 ? `-£${Math.abs(value).toFixed(0)}m` : `£${value.toFixed(0)}m`;
  };

  const formatYear = (year) => `${year}–${String(year + 1).slice(-2)}`;

  // Check which policies have non-zero values
  const hasNonZeroValues = (policyName) => {
    return data.some((d) => Math.abs(d[policyName] || 0) > 0.001);
  };

  const activePolicies = ALL_POLICY_NAMES.filter(hasNonZeroValues);

  return (
    <div className="budget-bar-chart">
      {title && <h3 className="chart-title">{title}</h3>}
      {description && <p className="chart-description">{description}</p>}

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
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
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name) => [formatValue(value), name]}
            labelFormatter={formatYear}
          />
          {stacked && <Legend />}
          <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />

          {stacked ? (
            ALL_POLICY_NAMES.map((policyName) => (
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
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
