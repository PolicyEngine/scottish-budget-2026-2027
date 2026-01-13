import { useState, useEffect, useRef, useCallback } from "react";
import DecileChart from "./DecileChart";
import BudgetBarChart from "./BudgetBarChart";
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

          // Transform to decile format for chart (2026 data)
          const decileData = data
            .filter(row => row.year === "2026" && row.reform_id === selectedPolicy)
            .map(row => ({
              decile: row.decile,
              relativeChange: parseFloat(row.value) || 0,
              absoluteChange: parseFloat(row.absolute_change) || 0,
            }));

          // Calculate average income change per year for baseline vs reform chart
          const incomeChangeByYear = {};
          data.filter(row => row.reform_id === selectedPolicy).forEach(row => {
            const year = parseInt(row.year);
            if (!incomeChangeByYear[year]) {
              incomeChangeByYear[year] = { totalChange: 0, count: 0 };
            }
            incomeChangeByYear[year].totalChange += parseFloat(row.absolute_change) || 0;
            incomeChangeByYear[year].count += 1;
          });

          // Calculate average change per year
          const avgChangeByYear = {};
          Object.entries(incomeChangeByYear).forEach(([year, data]) => {
            avgChangeByYear[year] = data.count > 0 ? data.totalChange / data.count : 0;
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
        Currently viewing:
      </p>
      <ul className="policy-list">
        {policyInfo.explanation}
      </ul>

      {/* Budgetary Impact Bar Chart */}
      {budgetaryData && budgetaryData[selectedPolicy] && (
        <BudgetBarChart
          data={Object.entries(budgetaryData[selectedPolicy].years)
            .map(([year, value]) => ({ year: parseInt(year), value }))
            .sort((a, b) => a.year - b.year)}
          title="Estimated budgetary impact"
          description={`Estimated annual ${selectedPolicy === "income_tax_threshold_uplift" ? "cost (revenue foregone)" : "cost"} of the ${policyInfo.name} policy in Scotland.`}
          tooltipLabel="Cost"
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
        This section shows how household incomes in Scotland change as a result of the {policyInfo.name} policy.
      </p>

      <div className="section-box" style={{ marginTop: "var(--pe-space-lg)" }}>
        <h3 className="chart-title">Average income change from {policyInfo.name}</h3>
        <p className="chart-description">
          Average change in household net income due to the policy, across all Scottish households.
          {selectedPolicy === "scp_baby_boost" && " The change is small when averaged across all households because only families with babies under 1 receiving SCP benefit."}
          {selectedPolicy === "income_tax_threshold_uplift" && " Most Scottish taxpayers will see a benefit from the increased thresholds."}
        </p>
        <BudgetBarChart
          data={(() => {
            const avgChange = livingStandardsData?.avgChangeByYear || {};
            return [2026, 2027, 2028, 2029, 2030]
              .filter(year => avgChange[year] !== undefined)
              .map(year => ({ year, value: avgChange[year] }));
          })()}
          yLabel="Average income change (£)"
          yFormat={(v) => `£${v.toFixed(2)}`}
          tooltipLabel="Income change"
        />
      </div>

      {/* Decile Impact Chart */}
      {livingStandardsData?.byDecile && livingStandardsData.byDecile.length > 0 && (
        <DecileChart
          data={livingStandardsData.byDecile}
          title="Impact by income decile"
          description={
            selectedPolicy === "scp_baby_boost"
              ? "The SCP baby boost is a targeted policy that only benefits families receiving Scottish Child Payment (a means-tested benefit) with babies under 1. Higher income deciles show no impact because they don't qualify for SCP. Values shown are averages across all households in each decile."
              : "The income tax threshold uplift benefits taxpayers across income levels, with the largest absolute gains in middle deciles where more taxpayers are affected by the threshold changes."
          }
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
