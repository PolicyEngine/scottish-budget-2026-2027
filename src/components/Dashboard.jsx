import { useState, useEffect, useRef, useCallback } from "react";
import DecileChart from "./DecileChart";
import BudgetBarChart from "./BudgetBarChart";
import StackedBudgetBarChart from "./StackedBudgetBarChart";
import StackedDecileChart from "./StackedDecileChart";
import PovertyImpactTable from "./PovertyImpactTable";
import LocalAreaSection from "./LocalAreaSection";
import "./Dashboard.css";

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "living-standards", label: "Living standards" },
  { id: "poverty", label: "Poverty" },
  { id: "local-areas", label: "Local areas" },
];

// Policy descriptions
const POLICY_INFO = {
  scp_baby_boost: {
    name: "SCP baby boost",
    description: "Scottish Child Payment boosted to £40/week for babies under 1",
    explanation: (
      <li>
        <strong>Scottish Child Payment baby boost</strong>: The Scottish Child Payment is boosted to £40/week
        for families with babies under 1 year old (up from £27.15/week), delivering the "strongest package
        of support for families with young children anywhere in the UK".
      </li>
    ),
  },
  income_tax_threshold_uplift: {
    name: "Income tax threshold uplift",
    description: "Basic and intermediate rate thresholds increased by 7.4%",
    explanation: (
      <li>
        <strong>Income tax threshold uplift (7.4%)</strong>: The basic rate (20%) threshold rises from £15,398
        to £16,537, and the intermediate rate (21%) threshold rises from £27,492 to £29,527. This means
        taxpayers pay the lower 19% starter rate on more of their income.
      </li>
    ),
  },
};

export default function Dashboard({ selectedPolicy = "scp_baby_boost" }) {
  const [loading, setLoading] = useState(true);
  const [livingStandardsData, setLivingStandardsData] = useState(null);
  const [stackedDecileData, setStackedDecileData] = useState([]);
  const [stackedIncomeChangeData, setStackedIncomeChangeData] = useState([]);
  const [povertyMetrics, setPovertyMetrics] = useState([]);
  const [budgetaryData, setBudgetaryData] = useState(null);
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
        const [distRes, metricsRes, budgetRes] = await Promise.all([
          fetch("/data/distributional_impact.csv"),
          fetch("/data/metrics.csv"),
          fetch("/data/budgetary_impact.csv"),
        ]);

        if (distRes.ok) {
          const csvText = await distRes.text();
          const data = parseCSV(csvText);

          // Transform to decile format for chart (2026 data) - single policy
          const decileData = data
            .filter(row => row.year === "2026" && row.reform_id === selectedPolicy)
            .map(row => ({
              decile: row.decile,
              relativeChange: parseFloat(row.value) || 0,
              absoluteChange: parseFloat(row.absolute_change) || 0,
            }));

          // Create STACKED decile data (both reforms, 2026)
          const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
          const stackedDecile = deciles.map(decile => {
            const row = { decile };
            ["scp_baby_boost", "income_tax_threshold_uplift"].forEach(reformId => {
              const match = data.find(d => d.year === "2026" && d.reform_id === reformId && d.decile === decile);
              row[`${reformId}_relative`] = match ? parseFloat(match.value) || 0 : 0;
              row[`${reformId}_absolute`] = match ? parseFloat(match.absolute_change) || 0 : 0;
            });
            return row;
          });
          setStackedDecileData(stackedDecile);

          // Calculate average income change per year for each reform
          const incomeChangeByYearReform = {};
          data.forEach(row => {
            const year = parseInt(row.year);
            const reformId = row.reform_id;
            const key = `${year}_${reformId}`;
            if (!incomeChangeByYearReform[key]) {
              incomeChangeByYearReform[key] = { year, reformId, totalChange: 0, count: 0 };
            }
            incomeChangeByYearReform[key].totalChange += parseFloat(row.absolute_change) || 0;
            incomeChangeByYearReform[key].count += 1;
          });

          // Create STACKED income change data by year
          const years = [2026, 2027, 2028, 2029, 2030];
          const stackedIncome = years.map(year => {
            const row = { year };
            ["scp_baby_boost", "income_tax_threshold_uplift"].forEach(reformId => {
              const key = `${year}_${reformId}`;
              const d = incomeChangeByYearReform[key];
              row[reformId] = d && d.count > 0 ? d.totalChange / d.count : 0;
            });
            return row;
          });
          setStackedIncomeChangeData(stackedIncome);

          // Calculate average change per year (single policy - for backward compatibility)
          const avgChangeByYear = {};
          Object.values(incomeChangeByYearReform)
            .filter(d => d.reformId === selectedPolicy)
            .forEach(d => {
              avgChangeByYear[d.year] = d.count > 0 ? d.totalChange / d.count : 0;
            });

          setLivingStandardsData({ byDecile: decileData, avgChangeByYear });
        }

        if (metricsRes.ok) {
          const csvText = await metricsRes.text();
          const data = parseCSV(csvText);

          // Filter to selected policy and transform for table
          const policyMetrics = data
            .filter(row => row.reform_id === selectedPolicy)
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
  }, [selectedPolicy]);

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

  const policyInfo = POLICY_INFO[selectedPolicy] || POLICY_INFO.scp_baby_boost;

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
        Policies included:
      </p>
      <ul className="policy-list">
        {POLICY_INFO.scp_baby_boost.explanation}
        {POLICY_INFO.income_tax_threshold_uplift.explanation}
      </ul>

      {/* Budgetary Impact Stacked Bar Chart */}
      {budgetaryData && (
        <StackedBudgetBarChart
          data={(() => {
            // Combine both reforms into stacked data by year
            const years = [2026, 2027, 2028, 2029, 2030];
            return years.map(year => ({
              year,
              scp_baby_boost: budgetaryData.scp_baby_boost?.years[year] || 0,
              income_tax_threshold_uplift: budgetaryData.income_tax_threshold_uplift?.years[year] || 0,
            }));
          })()}
          title="Estimated budgetary impact"
          description="Estimated annual cost of the Scottish Budget 2026-27 measures."
        />
      )}

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
        This section shows how household incomes in Scotland change as a result of the Scottish Budget 2026-27 measures.
      </p>

      <div className="section-box" style={{ marginTop: "var(--pe-space-lg)" }}>
        <h3 className="chart-title">Average income change from Scottish Budget 2026-27</h3>
        <p className="chart-description">
          Average change in household net income due to both policies, across all Scottish households.
          The SCP baby boost only affects families with babies under 1 receiving SCP, while the income tax threshold uplift benefits most Scottish taxpayers.
        </p>
        <StackedBudgetBarChart
          data={stackedIncomeChangeData}
          yLabel="Average income change (£)"
          yFormat={(v) => `£${v.toFixed(2)}`}
        />
      </div>

      {/* Stacked Decile Impact Chart */}
      {stackedDecileData.length > 0 && (
        <StackedDecileChart
          data={stackedDecileData}
          title="Impact by income decile"
          description="Combined impact of both Scottish Budget measures by income decile. The SCP baby boost primarily benefits lower income households (who qualify for SCP), while the income tax threshold uplift benefits taxpayers across income levels."
        />
      )}

      {/* Poverty Section */}
      <h2 className="section-title" id="poverty" ref={(el) => (sectionRefs.current["poverty"] = el)}>Poverty</h2>
      <p className="chart-description">
        This section shows how poverty rates are projected to change under the budget measures.
        The Scottish Government has set ambitious targets to reduce child poverty.
        {selectedPolicy === "income_tax_threshold_uplift" && (
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

      {/* Local Areas Section */}
      <h2 className="section-title" id="local-areas" ref={(el) => (sectionRefs.current["local-areas"] = el)}>Local areas</h2>
      <p className="chart-description">
        This section shows how the budget measures affect different areas of Scotland. Select a constituency
        to see the estimated impact on households in that area.
      </p>

      <LocalAreaSection selectedPolicy={selectedPolicy} />
    </div>
  );
}
