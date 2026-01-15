import { useState } from "react";
import "./PovertyImpactTable.css";

/**
 * Table showing poverty rate impacts by year.
 */
export default function PovertyImpactTable({ data, title, policyName = "the selected policy" }) {
  const [housingCost, setHousingCost] = useState("bhc"); // "bhc" or "ahc"
  const [viewMode, setViewMode] = useState("absolute"); // "absolute" or "relative"

  if (!data || data.length === 0) {
    return (
      <div className="poverty-table-container">
        <h3 className="chart-title">{title || "Poverty impact"}</h3>
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  // Group data by year
  const byYear = {};
  data.forEach((row) => {
    const year = row.year;
    if (!byYear[year]) {
      byYear[year] = {};
    }
    byYear[year][row.metric] = row.value;
  });

  const years = Object.keys(byYear).sort();

  // Get metric keys based on housing cost selection
  const prefix = `${housingCost}_`;

  const getMetricKey = (base) => {
    // Check if data has prefixed metrics (new format) or unprefixed (old format)
    const firstYearData = byYear[years[0]];
    const fullKey = `${prefix}${base}`;
    if (firstYearData[fullKey] !== undefined) {
      return fullKey;
    }
    // Fallback to unprefixed for backward compatibility
    return base;
  };

  const formatRate = (value) => {
    if (value == null) return "—";
    return `${value.toFixed(1)}%`;
  };

  const formatChange = (value, baselineValue) => {
    if (value == null) return "—";
    if (viewMode === "relative") {
      // Relative change: percent change from baseline
      if (baselineValue == null || baselineValue === 0) return "—";
      const relChange = (value / baselineValue) * 100;
      const sign = relChange >= 0 ? "+" : "";
      return `${sign}${relChange.toFixed(2)}%`;
    }
    // Absolute change: percentage points
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}pp`;
  };

  const housingCostLabel = housingCost === "bhc" ? "Before Housing Costs (BHC)" : "After Housing Costs (AHC)";

  return (
    <div className="poverty-table-container">
      <h3 className="chart-title">{title || "Poverty rate impact by year"}</h3>
      <p className="chart-description">
        Change in poverty rates under {policyName} compared to baseline.
      </p>

      <div className="chart-controls">
        <div className="view-toggle">
          <button
            className={viewMode === "absolute" ? "active" : ""}
            onClick={() => setViewMode("absolute")}
          >
            Absolute (pp)
          </button>
          <button
            className={viewMode === "relative" ? "active" : ""}
            onClick={() => setViewMode("relative")}
          >
            Relative (%)
          </button>
        </div>
        <div className="view-toggle">
          <button
            className={housingCost === "bhc" ? "active" : ""}
            onClick={() => setHousingCost("bhc")}
          >
            Before housing costs
          </button>
          <button
            className={housingCost === "ahc" ? "active" : ""}
            onClick={() => setHousingCost("ahc")}
          >
            After housing costs
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="poverty-table">
          <thead>
            <tr>
              <th rowSpan={2}>Year</th>
              <th colSpan={3}>Overall poverty rate</th>
              <th colSpan={3}>Child poverty rate</th>
            </tr>
            <tr>
              <th>Baseline</th>
              <th>Reform</th>
              <th>Change</th>
              <th>Baseline</th>
              <th>Reform</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const d = byYear[year];
              const povertyBaseline = d[getMetricKey("poverty_rate_baseline")];
              const povertyChange = d[getMetricKey("poverty_rate_change")];
              const childPovertyBaseline = d[getMetricKey("child_poverty_rate_baseline")];
              const childPovertyChange = d[getMetricKey("child_poverty_rate_change")];
              return (
                <tr key={year}>
                  <td className="year-cell">{year}–{(parseInt(year) + 1).toString().slice(-2)}</td>
                  <td>{formatRate(povertyBaseline)}</td>
                  <td>{formatRate(d[getMetricKey("poverty_rate_reform")])}</td>
                  <td className="change-cell">{formatChange(povertyChange, povertyBaseline)}</td>
                  <td>{formatRate(childPovertyBaseline)}</td>
                  <td>{formatRate(d[getMetricKey("child_poverty_rate_reform")])}</td>
                  <td className="change-cell">{formatChange(childPovertyChange, childPovertyBaseline)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="table-note">
        Poverty is measured using the {housingCostLabel} definition: below 60% of UK median income. Change shown in {viewMode === "absolute" ? "percentage points (pp)" : "percent change from baseline"}.
      </p>
    </div>
  );
}
