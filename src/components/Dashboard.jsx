import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DecileChart from "./DecileChart";
import BudgetBarChart from "./BudgetBarChart";
import PovertyImpactTable from "./PovertyImpactTable";
import LocalAreaSection from "./LocalAreaSection";
import "./Dashboard.css";
import { POLICY_NAMES } from "../utils/policyConfig";

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "budgetary-impact", label: "Budgetary impact" },
  { id: "living-standards", label: "Living standards" },
  { id: "poverty", label: "Poverty rate" },
  { id: "constituencies", label: "Impact by constituency" },
];

// Policy descriptions (active voice, clear impacts)
const POLICY_INFO = {
  scp_inflation: {
    name: "SCP inflation adjustment",
    description: "Scottish Child Payment uprated from £27.15 to £28.20/week",
    explanation: (
      <li>
        <strong>SCP inflation adjustment</strong>: The Budget uprates the Scottish Child Payment
        from £27.15 to £28.20 per week (+3.9% for inflation). This benefits all families receiving
        SCP, providing approximately £55 extra per child per year.
      </li>
    ),
  },
  scp_baby_boost: {
    name: "SCP Premium for under-ones",
    description: "Scottish Child Payment raised to £40/week for babies under 1",
    explanation: (
      <li>
        <strong>SCP Premium for under-ones</strong>: The Budget raises the Scottish Child Payment
        to £40 per week for each child under one year old. This is £11.80/week extra on top of the
        inflation-adjusted rate of £28.20/week.
      </li>
    ),
  },
  income_tax_threshold_uplift: {
    name: "Income tax threshold uplift",
    description: "Basic and intermediate rate thresholds raised by 7.4%",
    explanation: (
      <li>
        <strong>Income tax threshold uplift (7.4%)</strong>: The Budget raises the basic rate (20%)
        threshold from £15,398 to £16,537, and the intermediate rate (21%) threshold from £27,492
        to £29,527. Scottish taxpayers pay the lower 19% starter rate on more of their income.
      </li>
    ),
  },
  combined: {
    name: "all policies",
    description: "Full Scottish Budget 2026-27 package",
    explanation: null, // Will be rendered dynamically
  },
};

export default function Dashboard({ selectedPolicies = [] }) {
  // Determine effective policy for data loading
  const effectivePolicy = useMemo(() => {
    if (selectedPolicies.length >= 2) return "combined";
    if (selectedPolicies.length === 1) return selectedPolicies[0];
    return null;
  }, [selectedPolicies]);

  const isStacked = selectedPolicies.length >= 2;
  const [loading, setLoading] = useState(true);
  const [livingStandardsData, setLivingStandardsData] = useState(null);
  const [povertyMetrics, setPovertyMetrics] = useState([]);
  const [budgetaryData, setBudgetaryData] = useState(null);
  const [rawBudgetaryData, setRawBudgetaryData] = useState([]);
  const [rawDistributionalData, setRawDistributionalData] = useState([]);
  const [activeSection, setActiveSection] = useState("introduction");
  const [selectedYear, setSelectedYear] = useState(2026);

  const AVAILABLE_YEARS = [2026, 2027, 2028, 2029, 2030];

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
      if (!effectivePolicy) return;

      try {
        const [distRes, metricsRes, budgetRes] = await Promise.all([
          fetch("/data/distributional_impact.csv"),
          fetch("/data/metrics.csv"),
          fetch("/data/budgetary_impact.csv"),
        ]);

        if (distRes.ok) {
          const csvText = await distRes.text();
          const data = parseCSV(csvText);

          // Store raw data for year selection and stacked charts
          setRawDistributionalData(data);

          // Get average income change per year from the "All" row (true weighted average)
          const avgChangeByYear = {};
          data
            .filter(row => row.reform_id === effectivePolicy && row.decile === "All")
            .forEach(row => {
              const year = parseInt(row.year);
              avgChangeByYear[year] = parseFloat(row.absolute_change) || 0;
            });

          setLivingStandardsData({ avgChangeByYear });
        }

        if (metricsRes.ok) {
          const csvText = await metricsRes.text();
          const data = parseCSV(csvText);

          // Filter to effective policy and transform for table
          const policyMetrics = data
            .filter(row => row.reform_id === effectivePolicy)
            .map(row => ({
              year: parseInt(row.year),
              metric: row.metric,
              value: parseFloat(row.value),
            }));
          setPovertyMetrics(policyMetrics);
        }

        if (budgetRes.ok) {
          const csvText = await budgetRes.text();
          const data = parseCSV(csvText);

          // Store raw data for stacked charts
          setRawBudgetaryData(data);

          // Group by reform
          const byReform = {};
          data.forEach(row => {
            const id = row.reform_id;
            if (!byReform[id]) {
              byReform[id] = {
                id,
                name: row.reform_name,
                years: {},
              };
            }
            byReform[id].years[row.year] = parseFloat(row.value) || 0;
          });

          setBudgetaryData(byReform);
        }
      } catch (err) {
        console.warn("Using fallback data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [effectivePolicy]);

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

  // Transform budgetary data for stacked charts
  const stackedBudgetData = useMemo(() => {
    if (!isStacked || rawBudgetaryData.length === 0) return null;

    const years = [2026, 2027, 2028, 2029, 2030];
    return years.map(year => {
      const dataPoint = { year };
      let netImpact = 0;

      selectedPolicies.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawBudgetaryData.find(
          r => r.reform_id === policyId && parseInt(r.year) === year
        );
        const value = row ? parseFloat(row.value) || 0 : 0;
        dataPoint[policyName] = value;
        netImpact += value;
      });

      dataPoint.netImpact = netImpact;
      return dataPoint;
    });
  }, [isStacked, rawBudgetaryData, selectedPolicies]);

  // Transform distributional data for stacked decile chart
  const stackedDecileData = useMemo(() => {
    if (!isStacked || rawDistributionalData.length === 0) return null;

    const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
    return deciles.map(decile => {
      const dataPoint = { decile };
      let netRelative = 0;
      let netAbsolute = 0;

      selectedPolicies.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawDistributionalData.find(
          r => r.reform_id === policyId && r.year === String(selectedYear) && r.decile === decile
        );
        const relValue = row ? parseFloat(row.value) || 0 : 0;
        const absValue = row ? parseFloat(row.absolute_change) || 0 : 0;
        dataPoint[`${policyName}_relative`] = relValue;
        dataPoint[`${policyName}_absolute`] = absValue;
        netRelative += relValue;
        netAbsolute += absValue;
      });

      dataPoint.netRelative = netRelative;
      dataPoint.netAbsolute = netAbsolute;
      return dataPoint;
    });
  }, [isStacked, rawDistributionalData, selectedPolicies, selectedYear]);

  // Transform average income change data for stacked chart
  const stackedAvgIncomeData = useMemo(() => {
    if (!isStacked || rawDistributionalData.length === 0) return null;

    const years = [2026, 2027, 2028, 2029, 2030];
    return years.map(year => {
      const dataPoint = { year };
      let netImpact = 0;

      selectedPolicies.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawDistributionalData.find(
          r => r.reform_id === policyId && r.year === String(year) && r.decile === "All"
        );
        const value = row ? parseFloat(row.absolute_change) || 0 : 0;
        dataPoint[policyName] = value;
        netImpact += value;
      });

      dataPoint.netImpact = netImpact;
      return dataPoint;
    }).filter(d => Object.keys(d).length > 1); // Only include years with data
  }, [isStacked, rawDistributionalData, selectedPolicies]);

  // Get decile data filtered by selected year
  const decileDataForYear = useMemo(() => {
    if (rawDistributionalData.length === 0) return [];

    return rawDistributionalData
      .filter(row =>
        row.year === String(selectedYear) &&
        row.reform_id === effectivePolicy &&
        row.decile !== "All"
      )
      .map(row => ({
        decile: row.decile,
        relativeChange: parseFloat(row.value) || 0,
        absoluteChange: parseFloat(row.absolute_change) || 0,
      }));
  }, [rawDistributionalData, selectedYear, effectivePolicy]);

  const policyInfo = POLICY_INFO[effectivePolicy] || POLICY_INFO.scp_baby_boost;

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
        Finance Secretary Shona Robison{" "}
        <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/documents/" target="_blank" rel="noopener noreferrer">announced</a>{" "}
        the Scottish Budget 2026–27 on 13 January 2026. This dashboard estimates how the budget
        affects household incomes, poverty rates, and different areas across Scotland.
      </p>
      <p className="chart-description" style={{ marginTop: "12px" }}>
        The Budget includes the following measures:
      </p>
      <ul className="policy-list">
        {isStacked ? (
          <>
            {POLICY_INFO.scp_inflation.explanation}
            {POLICY_INFO.scp_baby_boost.explanation}
            {POLICY_INFO.income_tax_threshold_uplift.explanation}
          </>
        ) : (
          policyInfo.explanation
        )}
      </ul>
      <details className="methodology-details">
        <summary>Methodology</summary>
        <p>
          This analysis uses the PolicyEngine microsimulation model, which{" "}
          <a href="https://github.com/PolicyEngine/policyengine-uk-data" target="_blank" rel="noopener noreferrer">reweights</a>{" "}
          the Family Resources Survey to match Scottish demographics. See also:{" "}
          <a href="https://www.policyengine.org/uk/scottish-budget-2026-27" target="_blank" rel="noopener noreferrer">pre-budget dashboard</a>{" "}
          | <a href="https://policyengine.org/uk/research/uk-poverty-analysis" target="_blank" rel="noopener noreferrer">poverty methodology</a>.
        </p>
      </details>

      {/* Budgetary Impact Section */}
      <h2 className="section-title" id="budgetary-impact" ref={(el) => (sectionRefs.current["budgetary-impact"] = el)}>Budgetary impact</h2>
      <p className="chart-description">
        This section shows the estimated fiscal cost of the budget measures to the Scottish Government.
      </p>

      {isStacked && stackedBudgetData ? (
        <BudgetBarChart
          data={stackedBudgetData}
          title="Estimated budgetary impact"
          description="Estimated annual cost of both policies combined. Each bar shows the contribution from each policy."
          tooltipLabel="Cost"
          stacked={true}
          selectedPolicies={selectedPolicies}
        />
      ) : budgetaryData && budgetaryData[effectivePolicy] && (
        <BudgetBarChart
          data={Object.entries(budgetaryData[effectivePolicy].years)
            .map(([year, value]) => ({ year: parseInt(year), value }))
            .sort((a, b) => a.year - b.year)}
          title="Estimated budgetary impact"
          description={`Estimated annual ${effectivePolicy === "income_tax_threshold_uplift" ? "cost (revenue foregone)" : "cost"} of the ${policyInfo.name} policy in Scotland.`}
          tooltipLabel="Cost"
        />
      )}

      {/* Living Standards Section */}
      <h2 className="section-title" id="living-standards" ref={(el) => (sectionRefs.current["living-standards"] = el)}>Living standards</h2>
      <p className="chart-description">
        This section shows how household incomes in Scotland change as a result of the {policyInfo.name} policy.
      </p>

      <div className="section-box" style={{ marginTop: "var(--pe-space-lg)" }}>
        <h3 className="chart-title">Average income change from {policyInfo.name}</h3>
        <p className="chart-description">
          Average change in household net income due to the policy, across all Scottish households.
          {effectivePolicy === "scp_baby_boost" && " The change is small when averaged across all households because only families with babies under 1 receiving SCP benefit."}
          {effectivePolicy === "income_tax_threshold_uplift" && " Most Scottish taxpayers will see a benefit from the increased thresholds."}
        </p>
        {isStacked && stackedAvgIncomeData ? (
          <BudgetBarChart
            data={stackedAvgIncomeData}
            yLabel="Average income change (£)"
            yFormat={(v) => `£${v.toFixed(0)}`}
            tooltipLabel="Income change"
            stacked={true}
            selectedPolicies={selectedPolicies}
            yMaxValue={40}
            yTickCount={5}
          />
        ) : (
          <BudgetBarChart
            data={(() => {
              const avgChange = livingStandardsData?.avgChangeByYear || {};
              return [2026, 2027, 2028, 2029, 2030]
                .filter(year => avgChange[year] !== undefined)
                .map(year => ({ year, value: avgChange[year] }));
            })()}
            yLabel="Average income change (£)"
            yFormat={(v) => `£${v.toFixed(0)}`}
            tooltipLabel="Income change"
            yMaxValue={40}
            yTickCount={5}
          />
        )}
      </div>

      {/* Decile Impact Chart */}
      {(isStacked && stackedDecileData) || decileDataForYear.length > 0 ? (
        <DecileChart
          data={decileDataForYear}
          title="Impact by income decile"
          description={
            effectivePolicy === "scp_baby_boost"
              ? "The SCP Premium for under-ones is a targeted policy that only benefits families receiving Scottish Child Payment (a means-tested benefit) with babies under 1. Higher income deciles show no impact because they don't qualify for SCP. Values shown are averages across all households in each decile."
              : effectivePolicy === "income_tax_threshold_uplift"
              ? "The income tax threshold uplift benefits taxpayers across income levels, with the largest absolute gains in middle deciles where more taxpayers are affected by the threshold changes."
              : "Combined impact of both policies across income deciles. The SCP Premium for under-ones targets lower income families while the income tax threshold uplift benefits taxpayers across income levels."
          }
          stacked={isStacked}
          stackedData={stackedDecileData}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableYears={AVAILABLE_YEARS}
        />
      ) : null}

      {/* Poverty Section */}
      <h2 className="section-title" id="poverty" ref={(el) => (sectionRefs.current["poverty"] = el)}>Poverty rate</h2>
      <p className="chart-description">
        This section shows how poverty rates change under the budget measures.
        The UK uses four poverty measures: absolute vs relative poverty, each measured before or after housing costs.
        Absolute poverty uses a fixed threshold (60% of 2010-11 median income, adjusted for inflation),
        while relative poverty uses 60% of current median income.
        {effectivePolicy === "income_tax_threshold_uplift" && (
          <strong> Note: Income tax threshold increases have minimal direct impact on poverty rates
          because people in poverty typically pay little or no income tax.</strong>
        )}
      </p>

      {/* Poverty Impact Table */}
      {povertyMetrics.length > 0 && (
        <PovertyImpactTable
          data={povertyMetrics}
          title="Poverty rate impact by year"
          policyName={`the ${policyInfo.name} policy`}
        />
      )}

      {/* Constituency Impact Section */}
      <h2 className="section-title" id="constituencies" ref={(el) => (sectionRefs.current["constituencies"] = el)}>Impact by constituency</h2>
      <p className="chart-description">
        This section shows how the budget measures affect different constituencies across Scotland.
        Select a constituency to see the estimated impact on households in that area.
      </p>

      <LocalAreaSection
        selectedPolicy={effectivePolicy}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        availableYears={AVAILABLE_YEARS}
      />
    </div>
  );
}
