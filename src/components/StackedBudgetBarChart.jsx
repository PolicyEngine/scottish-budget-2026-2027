import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import "./BudgetBarChart.css";

// Colors for each reform
const REFORM_COLORS = {
  scp_baby_boost: "#2C6496",
  income_tax_threshold_uplift: "#29AB87",
};

const REFORM_NAMES = {
  scp_baby_boost: "SCP baby boost",
  income_tax_threshold_uplift: "Income tax threshold uplift",
};

/**
 * Stacked bar chart showing multiple reforms by year.
 */
export default function StackedBudgetBarChart({
  data,
  title,
  description,
  yLabel = "Cost (£ millions)",
  yFormat,
  reforms = ["scp_baby_boost", "income_tax_threshold_uplift"],
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

  // Calculate y-axis domain based on stacked totals
  const maxValue = Math.max(
    ...data.map((d) =>
      reforms.reduce((sum, reform) => sum + Math.abs(d[reform] || 0), 0)
    )
  );
  const yMax = Math.ceil(maxValue * 1.2);

  return (
    <div className="budget-bar-chart">
      {title && <h3 className="chart-title">{title}</h3>}
      {description && <p className="chart-description">{description}</p>}

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="year"
            tickFormatter={formatYearRange}
            tick={{ fontSize: 12, fill: "#666" }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={formatValue}
            tick={{ fontSize: 12, fill: "#666" }}
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
            formatter={(value, name) => [formatValue(value), REFORM_NAMES[name] || name]}
            labelFormatter={(label) => formatYearRange(label)}
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
          {reforms.map((reform) => (
            <Bar
              key={reform}
              dataKey={reform}
              stackId="reforms"
              fill={REFORM_COLORS[reform]}
              radius={reform === reforms[reforms.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              name={reform}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
