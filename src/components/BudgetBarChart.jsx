import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./BudgetBarChart.css";

/**
 * Bar chart showing budgetary impact by year.
 */
export default function BudgetBarChart({ data, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="budget-bar-chart">
        <h3 className="chart-title">{title || "Budgetary impact"}</h3>
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  const formatValue = (value) => `£${value.toFixed(0)}m`;
  const formatYearRange = (year) => `${year}–${(year + 1).toString().slice(-2)}`;

  // Calculate y-axis domain
  const maxValue = Math.max(...data.map((d) => d.value));
  const yMax = Math.ceil(maxValue / 10) * 10 + 10; // Round up to nearest 10 + buffer

  return (
    <div className="budget-bar-chart">
      <h3 className="chart-title">{title || "Budgetary impact by year"}</h3>
      <p className="chart-description">
        Estimated annual cost of the SCP baby boost policy in Scotland.
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
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
            domain={[0, yMax]}
            tickFormatter={formatValue}
            tick={{ fontSize: 12, fill: "#666" }}
            label={{
              value: "Cost (£ millions)",
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
            formatter={(value) => [formatValue(value), "Cost"]}
            labelFormatter={(label) => formatYearRange(label)}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          />
          <Bar
            dataKey="value"
            fill="#319795"
            radius={[4, 4, 0, 0]}
            name="Cost"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
