import { useState } from "react";
import "./PovertyImpactTable.css";

/**
 * Table showing poverty rate impacts by year.
 *
 * UK has 4 poverty measures: absolute/relative × BHC/AHC
 * - Absolute poverty: below 60% of 2010-11 median income (adjusted for inflation)
 * - Relative poverty: below 60% of current year median income
 * - BHC: Before Housing Costs
 * - AHC: After Housing Costs
 */
export default function PovertyImpactTable({ data, title, policyName = "the selected policy" }) {
  const [povertyType, setPovertyType] = useState("abs"); // "abs" or "rel" (absolute vs relative poverty definition)
  const [housingCost, setHousingCost] = useState("bhc"); // "bhc" or "ahc"

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

  // Get metric keys based on poverty type and housing cost selection
  // New format: abs_bhc_poverty_rate_baseline, rel_ahc_child_poverty_rate_change, etc.
  // Fallback to old format: bhc_poverty_rate_baseline (treats as relative)
  const getMetricKey = (base) => {
    const firstYearData = byYear[years[0]];

    // Try new format first: e.g., "abs_bhc_poverty_rate_baseline"
    const newFormatKey = `${povertyType}_${housingCost}_${base}`;
    if (firstYearData[newFormatKey] !== undefined) {
      return newFormatKey;
    }

    // Fallback to old format (no poverty type prefix): e.g., "bhc_poverty_rate_baseline"
    const oldFormatKey = `${housingCost}_${base}`;
    if (firstYearData[oldFormatKey] !== undefined) {
      return oldFormatKey;
    }

    // Final fallback for very old format (no prefix at all)
    return base;
  };

  const formatRate = (value) => {
    if (value == null) return "—";
    return `${value.toFixed(1)}%`;
  };

  const formatChange = (value) => {
    if (value == null) return "—";
    // Always show as percentage points
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}pp`;
  };

  const povertyTypeLabel = povertyType === "abs"
    ? "absolute poverty (below 60% of 2010-11 median, inflation-adjusted)"
    : "relative poverty (below 60% of current median)";
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
            className={povertyType === "abs" ? "active" : ""}
            onClick={() => setPovertyType("abs")}
          >
            Absolute poverty
          </button>
          <button
            className={povertyType === "rel" ? "active" : ""}
            onClick={() => setPovertyType("rel")}
          >
            Relative poverty
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
              const povertyReform = d[getMetricKey("poverty_rate_reform")];
              const povertyChange = d[getMetricKey("poverty_rate_change")];
              const childPovertyBaseline = d[getMetricKey("child_poverty_rate_baseline")];
              const childPovertyReform = d[getMetricKey("child_poverty_rate_reform")];
              const childPovertyChange = d[getMetricKey("child_poverty_rate_change")];
              return (
                <tr key={year}>
                  <td className="year-cell">{year}–{(parseInt(year) + 1).toString().slice(-2)}</td>
                  <td>{formatRate(povertyBaseline)}</td>
                  <td>{formatRate(povertyReform)}</td>
                  <td className="change-cell">{formatChange(povertyChange)}</td>
                  <td>{formatRate(childPovertyBaseline)}</td>
                  <td>{formatRate(childPovertyReform)}</td>
                  <td className="change-cell">{formatChange(childPovertyChange)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="table-note">
        Poverty is measured using {povertyTypeLabel}, {housingCostLabel.toLowerCase()}. Change shown in percentage points (pp).
      </p>
    </div>
  );
}
