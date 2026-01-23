import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DecileChart from "./DecileChart";
import BudgetBarChart from "./BudgetBarChart";
import PovertyImpactTable from "./PovertyImpactTable";
import LocalAreaSection from "./LocalAreaSection";
import SFCComparisonTable from "./SFCComparisonTable";
import MansionTaxMap from "./MansionTaxMap";
import "./Dashboard.css";
import { POLICY_NAMES, ALL_POLICY_IDS, REVENUE_POLICIES } from "../utils/policyConfig";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Small chart component for threshold comparisons
const ThresholdChart = ({ data, baselineLabel = "Baseline", reformLabel = "Reform" }) => (
  <div style={{
    maxWidth: "450px",
    margin: "16px auto 8px auto",
    background: "#fafbfc",
    borderRadius: "8px",
    padding: "12px"
  }}>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          width={45}
        />
        <Tooltip
          formatter={(value, name) => [`£${value.toLocaleString()}`, name]}
          labelFormatter={(label) => label}
          contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        <Line
          type="monotone"
          dataKey="baseline"
          stroke="#9CA3AF"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: "#9CA3AF" }}
          name={baselineLabel}
        />
        <Line
          type="monotone"
          dataKey="reform"
          stroke="#0D9488"
          strokeWidth={2}
          dot={{ r: 3, fill: "#0D9488" }}
          name={reformLabel}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// Data for threshold charts
const BASIC_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 15398, reform: 15398 },
  { year: "2026-27", baseline: 15706, reform: 16538 },
  { year: "2027-28", baseline: 16020, reform: 16872 },
  { year: "2028-29", baseline: 16341, reform: 17216 },
  { year: "2029-30", baseline: 16667, reform: 17567 },
  { year: "2030-31", baseline: 17001, reform: 17918 },
];

const INTERMEDIATE_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 27492, reform: 27492 },
  { year: "2026-27", baseline: 28042, reform: 29527 },
  { year: "2027-28", baseline: 28603, reform: 30123 },
  { year: "2028-29", baseline: 29175, reform: 30738 },
  { year: "2029-30", baseline: 29758, reform: 31365 },
  { year: "2030-31", baseline: 30354, reform: 31992 },
];

const HIGHER_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 43662, reform: 43662 },
  { year: "2026-27", baseline: 43662, reform: 43662 },
  { year: "2027-28", baseline: 44544, reform: 43662 },
  { year: "2028-29", baseline: 45453, reform: 43662 },
  { year: "2029-30", baseline: 46380, reform: 44553 },
  { year: "2030-31", baseline: 47308, reform: 45444 },
];

const ADVANCED_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 75000, reform: 75000 },
  { year: "2026-27", baseline: 75000, reform: 75000 },
  { year: "2027-28", baseline: 76515, reform: 75000 },
  { year: "2028-29", baseline: 78076, reform: 75000 },
  { year: "2029-30", baseline: 79669, reform: 76530 },
  { year: "2030-31", baseline: 81262, reform: 78061 },
];

const TOP_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 125140, reform: 125140 },
  { year: "2026-27", baseline: 125140, reform: 125140 },
  { year: "2027-28", baseline: 127668, reform: 125140 },
  { year: "2028-29", baseline: 130273, reform: 125140 },
  { year: "2029-30", baseline: 132930, reform: 127693 },
  { year: "2030-31", baseline: 135589, reform: 130247 },
];

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "income-tax-benefits", label: "Income tax and benefits" },
  { id: "mansion-tax", label: "Mansion tax" },
];

// Common table styles
const tableStyle = {
  margin: "12px auto 0 auto",
  width: "auto",
  borderCollapse: "collapse",
  fontSize: "14px",
  backgroundColor: "#fafafa",
  borderRadius: "6px",
  overflow: "hidden",
};
const thStyle = { textAlign: "left", padding: "10px 16px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" };
const thCenterStyle = { textAlign: "center", padding: "10px 16px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" };
const thRightStyle = { textAlign: "right", padding: "10px 16px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" };
const tdStyle = { padding: "10px 16px", borderBottom: "1px solid #e5e7eb" };
const tdCenterStyle = { textAlign: "center", padding: "10px 16px", borderBottom: "1px solid #e5e7eb" };
const tdRightStyle = { textAlign: "right", padding: "10px 16px", borderBottom: "1px solid #e5e7eb" };
const noteStyle = { marginTop: "12px", fontSize: "13px", color: "#666", textAlign: "left", width: "100%" };
const summaryStyle = { cursor: "pointer", color: "#2c6e49", fontWeight: "500" };

// Policy descriptions (active voice, clear impacts)
const POLICY_INFO = {
  scp_baby_boost: {
    name: "SCP Premium for under-ones",
    description: "Scottish Child Payment raised to £40/week for babies under 1",
    explanation: (
      <li>
        <strong>SCP Premium for under-ones</strong>: The Budget raises the Scottish Child Payment
        to £40 per week for children under one year old (£11.15/week extra in 2027-28). Both the
        total and standard rate are CPI uprated annually. Commences 2027-28, subject to parliamentary approval.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View baby boost rates by year</summary>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Weekly rate</th>
                <th style={thRightStyle}>Under-1 premium</th>
                <th style={thRightStyle}>Weekly total</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£27.15</td><td style={tdRightStyle}>—</td><td style={tdRightStyle}>£27.15</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£28.20</td><td style={tdRightStyle}>—</td><td style={tdRightStyle}>£28.20</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£28.85</td><td style={{...tdRightStyle, color: "#2e7d32"}}>+£11.15</td><td style={{...tdRightStyle, color: "#2e7d32"}}>£40.00</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£29.45</td><td style={{...tdRightStyle, color: "#2e7d32"}}>+£11.35</td><td style={{...tdRightStyle, color: "#2e7d32"}}>£40.80</td></tr>
              <tr><td style={tdStyle}>2029-30</td><td style={tdRightStyle}>£30.05</td><td style={{...tdRightStyle, color: "#2e7d32"}}>+£11.60</td><td style={{...tdRightStyle, color: "#2e7d32"}}>£41.65</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31</td><td style={{...tdRightStyle, borderBottom: "none"}}>£30.65</td><td style={{...tdRightStyle, borderBottom: "none", color: "#2e7d32"}}>+£11.85</td><td style={{...tdRightStyle, borderBottom: "none", color: "#2e7d32"}}>£42.50</td></tr>
            </tbody>
          </table>
          <p style={noteStyle}>Note: Under-one premium starts 2027-28. Both standard rate and premium uprated by CPI annually. Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/" target="_blank" rel="noopener noreferrer">Scottish Budget 2026-27</a> | <a href="https://www.gov.scot/news/a-budget-to-tackle-child-poverty/" target="_blank" rel="noopener noreferrer">Scottish Government announcement</a></p>
        </details>
      </li>
    ),
  },
  income_tax_basic_uplift: {
    name: "Basic rate threshold uplift",
    description: "Basic rate threshold raised from £15,398 to £16,538 (+7.4%)",
    explanation: (
      <li>
        <strong>Basic rate threshold uplift (+7.4%)</strong>: The Budget raises the basic rate (20%)
        threshold from £15,398 to £16,538. This means taxpayers can earn £1,140 more before paying
        the 20% basic rate instead of the 19% starter rate.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View basic rate threshold by year</summary>
          <ThresholdChart data={BASIC_RATE_THRESHOLD_DATA} />
          <p style={noteStyle}>Note: Baseline shows CPI-only growth . Reform shows 7.4% uplift in 2026-27, then CPI growth. Source: <a href="https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/" target="_blank" rel="noopener noreferrer">Scottish Government</a> | <a href="https://obr.uk/efo/economic-and-fiscal-outlook-november-2025/" target="_blank" rel="noopener noreferrer">OBR EFO November 2025</a></p>
        </details>
      </li>
    ),
  },
  income_tax_intermediate_uplift: {
    name: "Intermediate rate threshold uplift",
    description: "Intermediate rate threshold raised from £27,492 to £29,527 (+7.4%)",
    explanation: (
      <li>
        <strong>Intermediate rate threshold uplift (+7.4%)</strong>: The Budget raises the intermediate
        rate (21%) threshold from £27,492 to £29,527. This means taxpayers can earn £2,035 more before
        paying the 21% intermediate rate instead of the 20% basic rate.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View intermediate rate threshold by year</summary>
          <ThresholdChart data={INTERMEDIATE_RATE_THRESHOLD_DATA} />
          <p style={noteStyle}>Note: Baseline shows CPI-only growth . Reform shows 7.4% uplift in 2026-27, then CPI growth. Source: <a href="https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/" target="_blank" rel="noopener noreferrer">Scottish Government</a> | <a href="https://obr.uk/efo/economic-and-fiscal-outlook-november-2025/" target="_blank" rel="noopener noreferrer">OBR EFO November 2025</a></p>
        </details>
      </li>
    ),
  },
  higher_rate_freeze: {
    name: "Higher rate threshold freeze",
    description: "Higher rate threshold frozen at £43,662 until 2028-29",
    explanation: (
      <li>
        <strong>Higher rate threshold freeze</strong>: The higher rate (42%) threshold remains frozen
        at £43,662 from 2025-26 through 2028-29, then resumes CPI uprating (£44,553 in 2029-30, £45,444 in 2030-31).
        Without the freeze, the threshold would reach ~£47k by 2030-31. The freeze raises revenue by bringing more taxpayers into the higher rate band.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View higher rate threshold by year</summary>
          <ThresholdChart data={HIGHER_RATE_THRESHOLD_DATA} />
          <p style={noteStyle}>Note: Baseline assumes CPI growth after 2026-27. Freeze confirmed until 2028-29; 2029-30 onwards assumes CPI uprating. Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/3/" target="_blank" rel="noopener noreferrer">Scottish Budget Chapter 2</a> | <a href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-january-2026/" target="_blank" rel="noopener noreferrer">SFC January 2026</a></p>
        </details>
      </li>
    ),
  },
  advanced_rate_freeze: {
    name: "Advanced rate threshold freeze",
    description: "Advanced rate threshold frozen at £75,000 until 2028-29",
    explanation: (
      <li>
        <strong>Advanced rate threshold freeze</strong>: The advanced rate (45%) threshold remains frozen
        at £75,000 from 2025-26 through 2028-29, then resumes CPI uprating (£76,530 in 2029-30, £78,061 in 2030-31).
        Without the freeze, the threshold would reach ~£81k by 2030-31. The freeze raises revenue from higher earners.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View advanced rate threshold by year</summary>
          <ThresholdChart data={ADVANCED_RATE_THRESHOLD_DATA} />
          <p style={noteStyle}>Note: Baseline assumes CPI growth after 2026-27. Freeze confirmed until 2028-29; 2029-30 onwards assumes CPI uprating. Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/3/" target="_blank" rel="noopener noreferrer">Scottish Budget Chapter 2</a> | <a href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-january-2026/" target="_blank" rel="noopener noreferrer">SFC January 2026</a></p>
        </details>
      </li>
    ),
  },
  top_rate_freeze: {
    name: "Top rate threshold freeze",
    description: "Top rate threshold frozen at £125,140 until 2028-29",
    explanation: (
      <li>
        <strong>Top rate threshold freeze</strong>: The top rate (48%) threshold remains frozen
        at £125,140 from 2025-26 through 2028-29, then resumes CPI uprating (£127,693 in 2029-30, £130,247 in 2030-31).
        Without the freeze, the threshold would reach ~£136k by 2030-31. The freeze raises revenue from the highest earners.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View top rate threshold by year</summary>
          <ThresholdChart data={TOP_RATE_THRESHOLD_DATA} />
          <p style={noteStyle}>Note: Baseline assumes CPI growth after 2026-27. Freeze confirmed until 2028-29; 2029-30 onwards assumes CPI uprating. £125,140 aligns with UK Personal Allowance taper. Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/3/" target="_blank" rel="noopener noreferrer">Scottish Budget Chapter 2</a> | <a href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-january-2026/" target="_blank" rel="noopener noreferrer">SFC January 2026</a></p>
        </details>
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
  const [povertyMetrics, setPovertyMetrics] = useState([]);
  const [budgetaryData, setBudgetaryData] = useState(null);
  const [rawBudgetaryData, setRawBudgetaryData] = useState([]);
  const [rawDistributionalData, setRawDistributionalData] = useState([]);
  const [activeSection, setActiveSection] = useState("introduction");
  const [selectedYear, setSelectedYear] = useState(2028);

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

      ALL_POLICY_IDS.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawBudgetaryData.find(
          r => r.reform_id === policyId && parseInt(r.year) === year
        );
        const value = row ? parseFloat(row.value) || 0 : 0;
        dataPoint[policyName] = value;
        // Only include in netImpact if policy is selected
        if (selectedPolicies.includes(policyId)) {
          netImpact += value;
        }
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

      ALL_POLICY_IDS.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawDistributionalData.find(
          r => r.reform_id === policyId && r.year === String(selectedYear) && r.decile === decile
        );
        const relValue = row ? parseFloat(row.value) || 0 : 0;
        const absValue = row ? parseFloat(row.absolute_change) || 0 : 0;
        dataPoint[`${policyName}_relative`] = relValue;
        dataPoint[`${policyName}_absolute`] = absValue;
        // Only include in net if policy is selected
        if (selectedPolicies.includes(policyId)) {
          netRelative += relValue;
          netAbsolute += absValue;
        }
      });

      dataPoint.netRelative = netRelative;
      dataPoint.netAbsolute = netAbsolute;
      return dataPoint;
    });
  }, [isStacked, rawDistributionalData, selectedYear, selectedPolicies]);

  // Calculate decile chart y-axis domain across ALL years for consistent axis
  const decileYAxisDomain = useMemo(() => {
    if (!isStacked || rawDistributionalData.length === 0) return null;

    const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
    let maxAbsRelative = 0;
    let maxAbsAbsolute = 0;

    // Check all years to find max values
    AVAILABLE_YEARS.forEach(year => {
      deciles.forEach(decile => {
        let posRelative = 0, negRelative = 0;
        let posAbsolute = 0, negAbsolute = 0;

        selectedPolicies.forEach(policyId => {
          const policyName = POLICY_NAMES[policyId];
          const row = rawDistributionalData.find(
            r => r.reform_id === policyId && r.year === String(year) && r.decile === decile
          );
          const relValue = row ? parseFloat(row.value) || 0 : 0;
          const absValue = row ? parseFloat(row.absolute_change) || 0 : 0;

          // Check if this is a revenue policy (values should be negative)
          const isRevenue = REVENUE_POLICIES.includes(policyId);
          const adjustedRel = isRevenue ? -Math.abs(relValue) : relValue;
          const adjustedAbs = isRevenue ? -Math.abs(absValue) : absValue;

          if (adjustedRel > 0) posRelative += adjustedRel;
          else negRelative += adjustedRel;
          if (adjustedAbs > 0) posAbsolute += adjustedAbs;
          else negAbsolute += adjustedAbs;
        });

        maxAbsRelative = Math.max(maxAbsRelative, Math.abs(posRelative), Math.abs(negRelative));
        maxAbsAbsolute = Math.max(maxAbsAbsolute, Math.abs(posAbsolute), Math.abs(negAbsolute));
      });
    });

    // Round up to nice numbers
    const relInterval = maxAbsRelative <= 1 ? 0.5 : maxAbsRelative <= 3 ? 1 : 2;
    const absInterval = maxAbsAbsolute <= 50 ? 10 : maxAbsAbsolute <= 100 ? 20 : 50;
    const roundedRelative = Math.ceil((maxAbsRelative * 1.1) / relInterval) * relInterval || 1;
    const roundedAbsolute = Math.ceil((maxAbsAbsolute * 1.1) / absInterval) * absInterval || 40;

    return {
      relative: [-roundedRelative, roundedRelative],
      absolute: [-roundedAbsolute, roundedAbsolute],
    };
  }, [isStacked, rawDistributionalData, selectedPolicies]);

  // Get decile data filtered by selected year - aggregate selected policies
  const decileDataForYear = useMemo(() => {
    if (rawDistributionalData.length === 0) return [];

    // If multiple policies selected, aggregate their values
    if (selectedPolicies.length > 1) {
      const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
      return deciles.map(decile => {
        let relativeSum = 0;
        let absoluteSum = 0;

        selectedPolicies.forEach(policyId => {
          const row = rawDistributionalData.find(
            r => r.reform_id === policyId && r.year === String(selectedYear) && r.decile === decile
          );
          if (row) {
            relativeSum += parseFloat(row.value) || 0;
            absoluteSum += parseFloat(row.absolute_change) || 0;
          }
        });

        return {
          decile,
          relativeChange: relativeSum,
          absoluteChange: absoluteSum,
        };
      });
    }

    // Single policy - use directly
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
  }, [rawDistributionalData, selectedYear, effectivePolicy, selectedPolicies]);

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
        Finance Secretary Shona Robison <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/documents/" target="_blank" rel="noopener noreferrer">announced</a> the Scottish Budget 2026–27 on 13 January 2026.
        This dashboard estimates how the budget affects household incomes, poverty rates, and different areas across Scotland.
        The government also announced a{" "}
        <a
          href="#mansion-tax"
          onClick={(e) => {
            e.preventDefault();
            const mansionTaxSection = sectionRefs.current["mansion-tax"];
            if (mansionTaxSection) {
              mansionTaxSection.open = true;
              mansionTaxSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        >
          mansion tax
        </a>
        {" "}on high-value properties from April 2028, detailed in the last section.
      </p>
      <details className="budget-measures-details" style={{ marginTop: "12px" }}>
        <summary style={{ cursor: "pointer", color: "#2c6e49", fontWeight: "500" }}>
          Click to see what the Budget includes
        </summary>
        <ul className="policy-list">
          {isStacked ? (
            <>
              {POLICY_INFO.income_tax_basic_uplift.explanation}
              {POLICY_INFO.income_tax_intermediate_uplift.explanation}
              {POLICY_INFO.scp_baby_boost.explanation}
              {POLICY_INFO.higher_rate_freeze.explanation}
              {POLICY_INFO.advanced_rate_freeze.explanation}
              {POLICY_INFO.top_rate_freeze.explanation}
            </>
          ) : (
            policyInfo.explanation
          )}
        </ul>
        <details className="methodology-details" style={{ marginTop: "12px" }}>
          <summary>Methodology</summary>
          <p>
            This analysis uses the <a href="https://github.com/PolicyEngine/scottish-budget-2026-2027" target="_blank" rel="noopener noreferrer">PolicyEngine microsimulation model</a>, which{" "}
            <a href="https://github.com/PolicyEngine/policyengine-uk-data" target="_blank" rel="noopener noreferrer">reweights</a>{" "}
            the Family Resources Survey to match Scottish demographics. See also:{" "}
            <a href="https://www.policyengine.org/uk/scottish-budget-2026-27" target="_blank" rel="noopener noreferrer">pre-budget dashboard</a>{" "}
            | <a href="https://policyengine.org/uk/research/uk-poverty-analysis" target="_blank" rel="noopener noreferrer">poverty methodology</a>.
          </p>
        </details>
      </details>

      {/* Income Tax and Benefits Section */}
      <h2 className="section-title" id="income-tax-benefits" ref={(el) => (sectionRefs.current["income-tax-benefits"] = el)} style={{ marginTop: "32px" }}>Income tax and benefits</h2>

      {/* Budgetary Impact Section */}
      <h3 className="section-title" id="budgetary-impact" ref={(el) => (sectionRefs.current["budgetary-impact"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "24px", marginBottom: "12px", padding: "0" }}>Budgetary impact</h3>
      <p className="chart-description">
        This section shows the estimated fiscal cost of the budget measures to the Scottish Government.
      </p>

      {isStacked && stackedBudgetData ? (
        <BudgetBarChart
          data={stackedBudgetData}
          title="Estimated budgetary impact"
          description="Positive values indicate revenue gains for the Government, whilst negative values indicate costs to the Treasury."
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
          description="Positive values indicate revenue gains for the Government, whilst negative values indicate costs to the Treasury."
          tooltipLabel="Cost"
        />
      )}

      {/* SFC Comparison Table */}
      <SFCComparisonTable />

      {/* Living Standards Section */}
      <h3 className="section-title" id="living-standards" ref={(el) => (sectionRefs.current["living-standards"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb", marginBottom: "12px", padding: "32px 0 0 0" }}>Living standards</h3>
      <p className="chart-description">
        This section shows how household incomes in Scotland change as a result of the {policyInfo.name} policy.
      </p>

      {/* Decile Impact Chart */}
      {(isStacked && stackedDecileData) || decileDataForYear.length > 0 ? (
        <DecileChart
          data={decileDataForYear}
          title="Impact by income decile"
          description={
            effectivePolicy === "scp_baby_boost"
              ? "The SCP Premium for under-ones is a targeted policy that only benefits families receiving Scottish Child Payment (a means-tested benefit) with babies under 1. Higher income deciles show no impact because they don't qualify for SCP. Values shown are averages across all households in each decile."
              : "Combined impact of selected policies across income deciles. SCP policies target lower income families, income tax threshold uplifts benefit middle deciles, and threshold freezes affect higher earners."
          }
          stacked={isStacked}
          stackedData={stackedDecileData}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableYears={AVAILABLE_YEARS}
          selectedPolicies={selectedPolicies}
          fixedYAxisDomain={decileYAxisDomain}
        />
      ) : null}

      {/* Poverty Section */}
      <h3 className="section-title" id="poverty" ref={(el) => (sectionRefs.current["poverty"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb", marginBottom: "12px", padding: "32px 0 0 0" }}>Poverty rate</h3>
      <p className="chart-description">
        This section shows how poverty rates change under the budget measures.
        The UK uses four poverty measures: absolute vs relative poverty, each measured before or after housing costs.
        Absolute poverty uses a fixed threshold (60% of 2010-11 median income, adjusted for inflation),
        while relative poverty uses 60% of current median income.
              </p>

      {/* Poverty Impact Table */}
      {povertyMetrics.length > 0 && (
        <PovertyImpactTable
          data={povertyMetrics}
          title="Poverty rate impact by year"
          policyName={`the ${policyInfo.name} policy`}
        />
      )}

      {/* Local Authority Impact Section */}
      <h3 className="section-title" id="local-authorities" ref={(el) => (sectionRefs.current["local-authorities"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb", marginBottom: "12px", padding: "32px 0 0 0" }}>Impact by local authority</h3>
      <p className="chart-description">
        This section shows how the budget measures affect different local authorities across Scotland.
        Select a local authority to see the estimated impact on households in that area.
      </p>

      <LocalAreaSection
        selectedPolicies={selectedPolicies}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        availableYears={AVAILABLE_YEARS}
      />

      {/* Mansion Tax Section */}
      <details className="mansion-tax-section" id="mansion-tax" ref={(el) => (sectionRefs.current["mansion-tax"] = el)} style={{ marginTop: "32px" }}>
        <summary className="section-title" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="expand-icon" style={{ fontSize: "12px" }}>▶</span>
          Mansion tax
        </summary>
        <p className="chart-description" style={{ marginTop: "12px" }}>
          The Scottish Budget 2026-27 <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/5/" target="_blank" rel="noopener noreferrer">introduced</a> two new council tax bands for properties with a 2026 market value above £1 million,
          effective from April 2028. The Finance Secretary <a href="https://www.lbc.co.uk/article/wealthy-scots-in-snp-sights-as-budget-proposes-mansion-house-tax-and-a-tax-on-pr-5HjdQg9_2/" target="_blank" rel="noopener noreferrer">estimated £16m</a> in annual revenue.
          The <a href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-january-2026/" target="_blank" rel="noopener noreferrer">SFC</a> does not cost this policy as Council Tax is a local tax outside their remit.
          Using UK benchmark rates, we estimate £18.5m in annual revenue. The map below shows each constituency's share. Edinburgh constituencies account for ~47% of total revenue.
        </p>
        <details className="methodology-details" style={{ marginTop: "12px", marginBottom: "16px" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#0F766E", fontWeight: 600 }}>How we calculate</summary>
          <div style={{
            marginTop: "12px",
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "8px",
            borderLeft: "3px solid #0F766E"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem", color: "#475569", lineHeight: 1.6 }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#0F766E", fontWeight: 600 }}>1.</span>
                <span>We estimate total revenue of £18.5m by multiplying 11,481 £1m+ properties in Scotland (from <a href="https://www.savills.com/insight-and-opinion/savills-news/339380/" target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E" }}>Savills</a>) by a £1,607 average annual rate. This rate is based on the UK's <a href="https://www.gov.uk/government/publications/high-value-council-tax-surcharge/high-value-council-tax-surcharge" target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E" }}>High Value Council Tax Surcharge</a> of £2,500/year for properties over £2m, from which we extrapolate £1,500/year for the Scottish £1-2m band. Using <a href="https://github.com/PolicyEngine/scotland-mansion-tax" target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E" }}>Savills 2024 sales data</a> (89% of sales £1-2m, 11% over £2m), we calculate the weighted average of £1,607/year.</span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#0F766E", fontWeight: 600 }}>2.</span>
                <span>We use council-level £1m+ sales data from <a href="https://www.ros.gov.uk/data-and-statistics/property-market-statistics/property-market-report-2024-25" target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E" }}>Registers of Scotland</a> to allocate revenue geographically across Scotland.</span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#0F766E", fontWeight: 600 }}>3.</span>
                <span>Within each council, we allocate to constituencies based on population weighted by <a href="https://www.gov.uk/government/statistical-data-sets/uk-house-price-index-data-downloads-april-2025" target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E" }}>Band H property concentration</a>. Band H threshold (&gt;£212k in 1991) equals ~£1.06m today, closely matching the £1m threshold.</span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#0F766E", fontWeight: 600 }}>4.</span>
                <span>Each constituency's revenue is calculated as its share of total sales multiplied by the £18.5m total revenue.</span>
              </div>
            </div>
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <a href="https://github.com/PolicyEngine/scottish-budget-2026-2027/tree/main/scotland-mansion-tax" target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E", fontWeight: 500, fontSize: "0.85rem" }}>
                View full methodology on GitHub →
              </a>
            </div>
          </div>
        </details>
        <div className="section-box map-section">
          <MansionTaxMap />
        </div>
      </details>
    </div>
  );
}
