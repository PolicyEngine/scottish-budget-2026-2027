import React, { useState, useEffect } from "react";
import "./SFCComparisonTable.css";

function SFCComparisonTable() {
  const [comparisonData, setComparisonData] = useState(null);
  const [showBehavioural, setShowBehavioural] = useState(true);

  useEffect(() => {
    // Fetch both SFC comparison data and PolicyEngine budgetary impact data
    Promise.all([
      fetch("/data/sfc_comparison.csv").then((res) => res.text()),
      fetch("/data/budgetary_impact.csv").then((res) => res.text()),
    ])
      .then(([sfcCsvText, peCsvText]) => {
        // Parse SFC data
        const sfcLines = sfcCsvText.trim().split("\n");
        const sfcHeaders = sfcLines[0].split(",");
        const staticIdx = sfcHeaders.indexOf("sfc_static_value");
        const behaviouralIdx = sfcHeaders.indexOf("sfc_post_behavioural_value");

        const sfcData = {};
        for (let i = 1; i < sfcLines.length; i++) {
          const values = sfcLines[i].split(",");
          const reform_id = values[0];
          const year = parseInt(values[2]);
          const key = `${reform_id}_${year}`;
          sfcData[key] = {
            reform_id,
            reform_name: values[1],
            year,
            sfc_static:
              staticIdx >= 0 && values[staticIdx]
                ? parseFloat(values[staticIdx])
                : null,
            sfc_behavioural:
              behaviouralIdx >= 0 && values[behaviouralIdx]
                ? parseFloat(values[behaviouralIdx])
                : null,
          };
        }

        // Parse PolicyEngine budgetary impact data
        const peLines = peCsvText.trim().split("\n");
        const peHeaders = peLines[0].split(",");
        const reformIdIdx = peHeaders.indexOf("reform_id");
        const yearIdx = peHeaders.indexOf("year");
        const valueIdx = peHeaders.indexOf("value");

        for (let i = 1; i < peLines.length; i++) {
          const values = peLines[i].split(",");
          const reform_id = values[reformIdIdx];
          const year = parseInt(values[yearIdx]);
          const pe_value = parseFloat(values[valueIdx]);
          const key = `${reform_id}_${year}`;

          if (sfcData[key]) {
            sfcData[key].policyengine_value = pe_value;
          }
        }

        // Convert to array
        const data = Object.values(sfcData);
        setComparisonData(data);
      })
      .catch((err) => console.error("Error loading comparison data:", err));
  }, []);

  if (!comparisonData) return null;

  // Filter to policies that have SFC data (regardless of dashboard selection)
  const filteredData = comparisonData.filter(
    (row) => row.sfc_static !== null || row.sfc_behavioural !== null,
  );

  if (filteredData.length === 0) return null;

  // Check if we have both static and behavioural data
  const hasBothTypes = filteredData.some(
    (row) => row.sfc_static !== null && row.sfc_behavioural !== null,
  );

  // Define the order of policies to match SFC Table A.1
  const policyOrder = [
    "income_tax_basic_uplift",
    "income_tax_intermediate_uplift",
    "higher_rate_freeze",
    "advanced_rate_freeze",
    "top_rate_freeze",
    "scp_baby_boost",
  ];

  // Group by policy
  const policiesMap = {};
  filteredData.forEach((row) => {
    if (!policiesMap[row.reform_id]) {
      policiesMap[row.reform_id] = {
        name: row.reform_name,
        years: {},
      };
    }
    policiesMap[row.reform_id].years[row.year] = {
      policyengine: row.policyengine_value,
      sfc_static: row.sfc_static,
      sfc_behavioural: row.sfc_behavioural,
    };
  });

  const years = [2026, 2027, 2028, 2029, 2030];

  // Sort policies according to the defined order
  const policies = policyOrder
    .filter((id) => policiesMap[id])
    .map((id) => [id, policiesMap[id]]);

  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) return "—";
    const sign = value >= 0 ? "" : "-";
    return `${sign}£${Math.abs(value).toFixed(0)}m`;
  };

  const getDifferenceClass = (pe, sfc) => {
    if (pe === null || sfc === null || isNaN(pe) || isNaN(sfc)) return "";
    const diff = Math.abs(pe - sfc);
    if (diff < 10) return "diff-small";
    if (diff < 30) return "diff-medium";
    return "diff-large";
  };

  const getSfcValue = (yearData) => {
    if (showBehavioural && yearData.sfc_behavioural !== null) {
      return yearData.sfc_behavioural;
    }
    if (!showBehavioural && yearData.sfc_static !== null) {
      return yearData.sfc_static;
    }
    // Fallback to whichever is available
    return yearData.sfc_behavioural ?? yearData.sfc_static;
  };

  return (
    <div className="sfc-comparison-section">
      <h2>PolicyEngine vs SFC comparison</h2>
      <p className="comparison-description">
        This table compares PolicyEngine's static microsimulation estimates with
        the Scottish Fiscal Commission's official costings from the December 2024
        Economic and Fiscal Forecasts. Values show annual budgetary impact in
        millions of pounds. Positive values indicate revenue for the Government;
        negative values indicate costs.
      </p>

      {hasBothTypes && (
        <div className="sfc-toggle-container">
          <span className="toggle-label">
            Compare PolicyEngine (static) with SFC:
          </span>
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${!showBehavioural ? "active" : ""}`}
              onClick={() => setShowBehavioural(false)}
            >
              Static
            </button>
            <button
              className={`toggle-btn ${showBehavioural ? "active" : ""}`}
              onClick={() => setShowBehavioural(true)}
            >
              Post-behavioural
            </button>
          </div>
        </div>
      )}

      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th rowSpan="2">Policy</th>
              {years.map((year) => (
                <th key={year} colSpan="2" className="year-header">
                  {year}-{(year + 1).toString().slice(-2)}
                </th>
              ))}
            </tr>
            <tr>
              {years.map((year) => (
                <React.Fragment key={year}>
                  <th className="source-header pe">PE</th>
                  <th className="source-header sfc">SFC</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map(([policyId, policy]) => (
              <tr key={policyId}>
                <td className="policy-name-cell">{policy.name}</td>
                {years.map((year) => {
                  const yearData = policy.years[year] || {};
                  const pe = yearData.policyengine;
                  const sfc = getSfcValue(yearData);
                  return (
                    <React.Fragment key={year}>
                      <td
                        className={`value-cell pe ${getDifferenceClass(pe, sfc)}`}
                      >
                        {formatValue(pe)}
                      </td>
                      <td
                        className={`value-cell sfc ${getDifferenceClass(pe, sfc)}`}
                      >
                        {formatValue(sfc)}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="comparison-legend">
        <span className="legend-item">
          <span className="legend-dot diff-small"></span>
          Difference &lt; £10m
        </span>
        <span className="legend-item">
          <span className="legend-dot diff-medium"></span>
          Difference £10-30m
        </span>
        <span className="legend-item">
          <span className="legend-dot diff-large"></span>
          Difference &gt; £30m
        </span>
      </div>

      <p className="comparison-note">
        <strong>Note:</strong> PolicyEngine produces static microsimulation
        estimates that do not include behavioural responses.{" "}
        {showBehavioural
          ? "Post-behavioural costings include effects like tax avoidance, reduced consumption, and migration. SFC assumes behavioural responses reduce yields by ~8% for higher-rate freezes, ~25% for advanced-rate, and ~85% for top-rate."
          : "Static costings assume no change in taxpayer behaviour. Static values shown here are derived from post-behavioural figures using SFC's published behavioural adjustment rates."}{" "}
        Each provision is costed independently against baseline (not stacked).
      </p>
      <p className="comparison-note">
        <strong>Data notes:</strong> Threshold freezes show 2026-27 as empty because
        the freeze was already in Budget 2025-26; SFC only costs the incremental
        extension through 2027-28/2028-29. SCP baby boost starts mid-2027-28.
        SFC reports combined basic + intermediate thresholds (~£50m total); we
        apportion using PolicyEngine microsimulation. SCP inflation uprating has
        no SFC costing as it's included in their baseline. See{" "}
        <a
          href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-december-2024/"
          target="_blank"
          rel="noopener noreferrer"
        >
          SFC December 2024 Forecasts
        </a>{" "}
        and{" "}
        <a
          href="https://ifs.org.uk/publications/assessing-scottish-tax-strategy-and-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          IFS analysis
        </a>{" "}
        for methodology.
      </p>
    </div>
  );
}

export default SFCComparisonTable;
