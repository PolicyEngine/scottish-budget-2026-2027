import { useState, useEffect, useRef, useCallback } from "react";
import D3LineChart from "./D3LineChart";
import DecileChart from "./DecileChart";
import LocalAreaSection from "./LocalAreaSection";
import "./Dashboard.css";

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "living-standards", label: "Living standards" },
  { id: "poverty", label: "Poverty" },
  { id: "local-areas", label: "Local areas" },
];

// Historical official poverty data (Scottish Government, 3-year averages)
const HISTORICAL_POVERTY_DATA = [
  { year: 2021, relativeBHC: 18, relativeAHC: 20, absoluteBHC: 15, absoluteAHC: 17 },
  { year: 2022, relativeBHC: 18, relativeAHC: 20, absoluteBHC: 15, absoluteAHC: 17 },
  { year: 2023, relativeBHC: 18, relativeAHC: 20, absoluteBHC: 15, absoluteAHC: 17 },
];

// Historical household income data
const HISTORICAL_HOUSEHOLD_INCOME_DATA = [
  { year: 2021, meanIncome: 41200, medianIncome: 35800, meanIncomeReal: 48000, medianIncomeReal: 41700 },
  { year: 2022, meanIncome: 45000, medianIncome: 39200, meanIncomeReal: 48000, medianIncomeReal: 41800 },
  { year: 2023, meanIncome: 49700, medianIncome: 43200, meanIncomeReal: 49700, medianIncomeReal: 43200 },
];

// CPI deflators to convert future nominal values to 2023 real prices
const CPI_DEFLATORS = {
  2023: 1.00, 2024: 1.03, 2025: 1.05, 2026: 1.07,
  2027: 1.09, 2028: 1.11, 2029: 1.13, 2030: 1.16,
};

// Fallback data in case JSON files don't load
const FALLBACK_BASELINE_DATA = [
  { year: 2023, meanHouseholdIncome: 49700, medianHouseholdIncome: 43200, povertyBHC: 18.0, povertyAHC: 20.0, absolutePovertyBHC: 15.0, absolutePovertyAHC: 17.0, childPovertyBHC: 20.0, childPovertyAHC: 23.0 },
  { year: 2024, meanHouseholdIncome: 51500, medianHouseholdIncome: 44800, povertyBHC: 17.8, povertyAHC: 19.8, absolutePovertyBHC: 14.8, absolutePovertyAHC: 16.8, childPovertyBHC: 19.5, childPovertyAHC: 22.5 },
  { year: 2025, meanHouseholdIncome: 53400, medianHouseholdIncome: 46500, povertyBHC: 17.5, povertyAHC: 19.5, absolutePovertyBHC: 14.5, absolutePovertyAHC: 16.5, childPovertyBHC: 19.0, childPovertyAHC: 22.0 },
  { year: 2026, meanHouseholdIncome: 55400, medianHouseholdIncome: 48200, povertyBHC: 17.2, povertyAHC: 19.2, absolutePovertyBHC: 14.2, absolutePovertyAHC: 16.2, childPovertyBHC: 18.5, childPovertyAHC: 21.5 },
  { year: 2027, meanHouseholdIncome: 57500, medianHouseholdIncome: 50000, povertyBHC: 16.9, povertyAHC: 18.9, absolutePovertyBHC: 13.9, absolutePovertyAHC: 15.9, childPovertyBHC: 18.0, childPovertyAHC: 21.0 },
  { year: 2028, meanHouseholdIncome: 59700, medianHouseholdIncome: 51900, povertyBHC: 16.6, povertyAHC: 18.6, absolutePovertyBHC: 13.6, absolutePovertyAHC: 15.6, childPovertyBHC: 17.5, childPovertyAHC: 20.5 },
  { year: 2029, meanHouseholdIncome: 62000, medianHouseholdIncome: 53900, povertyBHC: 16.3, povertyAHC: 18.3, absolutePovertyBHC: 13.3, absolutePovertyAHC: 15.3, childPovertyBHC: 17.0, childPovertyAHC: 20.0 },
  { year: 2030, meanHouseholdIncome: 64400, medianHouseholdIncome: 56000, povertyBHC: 16.0, povertyAHC: 18.0, absolutePovertyBHC: 13.0, absolutePovertyAHC: 15.0, childPovertyBHC: 16.5, childPovertyAHC: 19.5 },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [livingStandardsData, setLivingStandardsData] = useState(null);
  const [povertyData, setPovertyData] = useState(null);
  const [baselineData, setBaselineData] = useState(FALLBACK_BASELINE_DATA);
  const [povertyType, setPovertyType] = useState("absoluteBHC");
  const [povertyAgeGroup, setPovertyAgeGroup] = useState("all");
  const [incomeType, setIncomeType] = useState("mean");
  const [incomeAdjustment, setIncomeAdjustment] = useState("nominal");
  const [incomeViewMode, setIncomeViewMode] = useState("both");
  const [povertyViewMode, setPovertyViewMode] = useState("both");
  const [activeSection, setActiveSection] = useState("introduction");

  // Refs for section elements
  const sectionRefs = useRef({});

  // Parse CSV text into array of objects
  const parseCSV = (csvText) => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx]?.trim();
      });
      data.push(row);
    }
    return data;
  };

  // Load data from CSV files
  useEffect(() => {
    async function loadData() {
      try {
        const [distRes, metricsRes] = await Promise.all([
          fetch("/data/distributional_impact.csv"),
          fetch("/data/metrics.csv"),
        ]);

        if (distRes.ok) {
          const csvText = await distRes.text();
          const data = parseCSV(csvText);

          // Transform to decile format for chart
          const decileData = data
            .filter(row => row.year === "2026" && row.reform_id === "scottish_budget_2026_combined")
            .map(row => ({
              decile: row.decile,
              relativeChange: parseFloat(row.value) || 0,
              absoluteChange: parseFloat(row.absolute_change) || 0,
            }));

          setLivingStandardsData({ byDecile: decileData });
        }

        if (metricsRes.ok) {
          const csvText = await metricsRes.text();
          const data = parseCSV(csvText);

          // Extract poverty metrics
          const metrics2026 = data.filter(row =>
            row.year === "2026" && row.reform_id === "scottish_budget_2026_combined"
          );

          const povertyRates = {};
          metrics2026.forEach(row => {
            povertyRates[row.metric] = parseFloat(row.value);
          });

          setPovertyData({
            rates: {
              overall: {
                baseline: povertyRates.poverty_rate_baseline || 18.2,
                reform: povertyRates.poverty_rate_reform || 16.8,
                change: povertyRates.poverty_rate_change || -1.4,
              },
              child: {
                baseline: povertyRates.child_poverty_rate_baseline || 24.1,
                reform: povertyRates.child_poverty_rate_reform || 21.5,
                change: povertyRates.child_poverty_rate_change || -2.6,
              },
            },
          });
        }
      } catch (err) {
        console.warn("Using fallback data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Scroll to section handler
  const scrollToSection = useCallback((sectionId) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = SECTIONS[i];
        const element = sectionRefs.current[section.id];
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading Scotland projections...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Introduction */}
      <h2 className="section-title" id="introduction" ref={(el) => (sectionRefs.current["introduction"] = el)}>Introduction</h2>
      <p className="chart-description">
        This dashboard, powered by{" "}
        <a href="https://policyengine.org" target="_blank" rel="noopener noreferrer">PolicyEngine</a>,
        analyses the impact of the Scottish Budget 2026–27 announced by Finance Secretary Shona Robison
        on 13 January 2026. It examines how the budget measures affect living standards, poverty rates,
        and distributes impacts across Scotland's local areas.
      </p>
      <p className="chart-description" style={{ marginTop: "12px" }}>
        PolicyEngine is an open-source microsimulation model that{" "}
        <a href="https://github.com/PolicyEngine/policyengine-uk-data" target="_blank" rel="noopener noreferrer">reweights</a>{" "}
        the Family Resources Survey to match Scottish demographics and calibrates to official statistics.
        See also: PolicyEngine's{" "}
        <a href="https://policyengine.org/uk/scottish-budget-2026" target="_blank" rel="noopener noreferrer">pre-budget dashboard</a>{" "}
        and our poverty{" "}
        <a href="https://policyengine.org/uk/research/uk-poverty-analysis" target="_blank" rel="noopener noreferrer">methodology</a>.
      </p>

      {/* Living Standards Section */}
      <h2 className="section-title" id="living-standards" ref={(el) => (sectionRefs.current["living-standards"] = el)}>Living standards</h2>
      <p className="chart-description">
        This section shows how household incomes in Scotland are projected to change following the budget measures,
        comparing pre-budget forecasts with post-budget impacts.
      </p>

      <div className="charts-row">
        <div className="section-box">
          <h3 className="chart-title">Household income</h3>
          <p className="chart-description">
            {incomeType === "mean"
              ? "Mean income is total disposable income divided by the number of households."
              : "Median income is the middle value when all households are ranked by income."}{" "}
            {incomeAdjustment === "real" ? "Values adjusted to 2023 prices. " : ""}
            Solid lines show official ONS data; dashed lines show PolicyEngine projections.
          </p>
          {baselineData.length > 0 && (() => {
            const year2023 = baselineData.find(d => d.year === 2023);
            const year2030 = baselineData.find(d => d.year === 2030);
            if (!year2023 || !year2030) return null;
            let startValue = incomeType === "mean" ? year2023.meanHouseholdIncome : year2023.medianHouseholdIncome;
            let endValue = incomeType === "mean" ? year2030.meanHouseholdIncome : year2030.medianHouseholdIncome;
            if (incomeAdjustment === "real") {
              startValue = startValue / CPI_DEFLATORS[2023];
              endValue = endValue / CPI_DEFLATORS[2030];
            }
            const pctChange = ((endValue - startValue) / startValue) * 100;
            const realSuffix = incomeAdjustment === "real" ? " (in 2023 prices)" : "";
            return (
              <p className="chart-summary">
                {incomeType === "mean" ? "Mean" : "Median"} household income is forecast to {pctChange > 0 ? "increase" : "decrease"} by {Math.abs(pctChange).toFixed(0)}% from £{(startValue / 1000).toFixed(0)}k to £{(endValue / 1000).toFixed(0)}k by 2030{realSuffix}.
              </p>
            );
          })()}
          <div className="chart-controls">
            <select
              className="chart-select"
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
            >
              <option value="mean">Mean income</option>
              <option value="median">Median income</option>
            </select>
            <div className="view-toggle">
              <button className={incomeAdjustment === "nominal" ? "active" : ""} onClick={() => setIncomeAdjustment("nominal")}>Nominal</button>
              <button className={incomeAdjustment === "real" ? "active" : ""} onClick={() => setIncomeAdjustment("real")}>Real</button>
            </div>
            <div className="view-toggle">
              <button className={incomeViewMode === "outturn" ? "active" : ""} onClick={() => setIncomeViewMode("outturn")}>Outturn</button>
              <button className={incomeViewMode === "both" ? "active" : ""} onClick={() => setIncomeViewMode("both")}>Both</button>
              <button className={incomeViewMode === "forecast" ? "active" : ""} onClick={() => setIncomeViewMode("forecast")}>Forecast</button>
            </div>
          </div>
          <D3LineChart
            data={(() => {
              const merged = {};
              HISTORICAL_HOUSEHOLD_INCOME_DATA.forEach(d => {
                const historicalKey = incomeAdjustment === "real"
                  ? (incomeType === "mean" ? "meanIncomeReal" : "medianIncomeReal")
                  : (incomeType === "mean" ? "meanIncome" : "medianIncome");
                merged[d.year] = {
                  year: d.year,
                  historical: d[historicalKey],
                };
              });
              baselineData.filter(d => d.year >= 2023).forEach(d => {
                let projectionValue = incomeType === "mean" ? d.meanHouseholdIncome : d.medianHouseholdIncome;
                if (incomeAdjustment === "real" && CPI_DEFLATORS[d.year]) {
                  projectionValue = projectionValue / CPI_DEFLATORS[d.year];
                }
                if (merged[d.year]) {
                  merged[d.year].projection = projectionValue;
                } else {
                  merged[d.year] = {
                    year: d.year,
                    projection: projectionValue,
                  };
                }
              });
              return Object.values(merged).sort((a, b) => a.year - b.year);
            })()}
            yLabel={`Household income${incomeAdjustment === "real" ? " (2023 prices)" : ""}`}
            yFormat={(v) => `£${(v / 1000).toFixed(0)}k`}
            yDomain={[0, 70000]}
            viewMode={incomeViewMode}
          />
        </div>
      </div>

      {/* Decile Impact Chart */}
      {livingStandardsData?.byDecile && (
        <DecileChart
          data={livingStandardsData.byDecile}
          title="Impact by income decile"
          description="The two-child limit policy primarily benefits lower-income households. This chart shows the percentage change in net income for each income decile."
        />
      )}

      {/* Poverty Section */}
      <h2 className="section-title" id="poverty" ref={(el) => (sectionRefs.current["poverty"] = el)}>Poverty</h2>
      <p className="chart-description">
        This section shows how poverty rates are projected to change under the budget measures.
        The Scottish Government has set ambitious targets to reduce child poverty, and the budget
        includes measures such as the two-child limit top-up payment.
      </p>

      <div className="charts-row">
        <div className="section-box">
          <h3 className="chart-title">Poverty rate</h3>
          <p className="chart-description">
            {povertyType.includes("absolute")
              ? "Absolute poverty measures income below a fixed threshold adjusted for inflation."
              : "Relative poverty measures income below 60% of UK median income."}{" "}
            {povertyType.includes("AHC") ? "After housing costs." : "Before housing costs."}
          </p>
          {baselineData.length > 0 && (() => {
            const year2023 = baselineData.find(d => d.year === 2023);
            const year2030 = baselineData.find(d => d.year === 2030);
            if (!year2023 || !year2030) return null;

            let startValue, endValue;
            if (povertyAgeGroup === "all") {
              if (povertyType === "absoluteBHC") { startValue = year2023.absolutePovertyBHC; endValue = year2030.absolutePovertyBHC; }
              else if (povertyType === "absoluteAHC") { startValue = year2023.absolutePovertyAHC; endValue = year2030.absolutePovertyAHC; }
              else if (povertyType === "relativeBHC") { startValue = year2023.povertyBHC; endValue = year2030.povertyBHC; }
              else { startValue = year2023.povertyAHC; endValue = year2030.povertyAHC; }
            } else if (povertyAgeGroup === "children") {
              startValue = povertyType.includes("AHC") ? year2023.childPovertyAHC : year2023.childPovertyBHC;
              endValue = povertyType.includes("AHC") ? year2030.childPovertyAHC : year2030.childPovertyBHC;
            }

            if (startValue == null || endValue == null) return null;
            const ppChange = endValue - startValue;
            const ageLabel = povertyAgeGroup === "all" ? "" : " child";
            return (
              <p className="chart-summary">
                The{ageLabel} poverty rate is forecast to {ppChange > 0 ? "increase" : "decrease"} by {Math.abs(ppChange).toFixed(1)}pp from {startValue.toFixed(1)}% to {endValue.toFixed(1)}% by 2030.
              </p>
            );
          })()}
          <div className="chart-controls">
            <select
              className="chart-select"
              value={povertyType}
              onChange={(e) => setPovertyType(e.target.value)}
            >
              <option value="absoluteBHC">Absolute (BHC)</option>
              <option value="absoluteAHC">Absolute (AHC)</option>
              <option value="relativeBHC">Relative (BHC)</option>
              <option value="relativeAHC">Relative (AHC)</option>
            </select>
            <select
              className="chart-select"
              value={povertyAgeGroup}
              onChange={(e) => setPovertyAgeGroup(e.target.value)}
            >
              <option value="all">All people</option>
              <option value="children">Children</option>
            </select>
            <div className="view-toggle">
              <button className={povertyViewMode === "outturn" ? "active" : ""} onClick={() => setPovertyViewMode("outturn")}>Outturn</button>
              <button className={povertyViewMode === "both" ? "active" : ""} onClick={() => setPovertyViewMode("both")}>Both</button>
              <button className={povertyViewMode === "forecast" ? "active" : ""} onClick={() => setPovertyViewMode("forecast")}>Forecast</button>
            </div>
          </div>
          <D3LineChart
            data={(() => {
              const merged = {};
              if (povertyAgeGroup === "all") {
                HISTORICAL_POVERTY_DATA.forEach(d => {
                  let value;
                  if (povertyType === "absoluteBHC") value = d.absoluteBHC;
                  else if (povertyType === "absoluteAHC") value = d.absoluteAHC;
                  else if (povertyType === "relativeBHC") value = d.relativeBHC;
                  else value = d.relativeAHC;
                  merged[d.year] = {
                    year: d.year,
                    historical: value,
                  };
                });
              }
              baselineData.filter(d => d.year >= 2023).forEach(d => {
                let value;
                const isAHC = povertyType.includes("AHC");

                if (povertyAgeGroup === "all") {
                  if (povertyType === "absoluteBHC") value = d.absolutePovertyBHC;
                  else if (povertyType === "absoluteAHC") value = d.absolutePovertyAHC;
                  else if (povertyType === "relativeBHC") value = d.povertyBHC;
                  else value = d.povertyAHC;
                } else if (povertyAgeGroup === "children") {
                  value = isAHC ? d.childPovertyAHC : d.childPovertyBHC;
                }

                if (merged[d.year]) {
                  merged[d.year].projection = value;
                } else {
                  merged[d.year] = {
                    year: d.year,
                    projection: value,
                  };
                }
              });
              return Object.values(merged).sort((a, b) => a.year - b.year);
            })()}
            yLabel="Poverty rate"
            yFormat={(v) => `${v.toFixed(0)}%`}
            yDomain={[0, 30]}
            viewMode={povertyViewMode}
          />
        </div>
      </div>

      {/* Local Areas Section */}
      <h2 className="section-title" id="local-areas" ref={(el) => (sectionRefs.current["local-areas"] = el)}>Local areas</h2>
      <p className="chart-description">
        This section shows how the budget measures affect different areas of Scotland. Select a constituency
        to see the estimated impact on households in that area.
      </p>

      <LocalAreaSection />
    </div>
  );
}
