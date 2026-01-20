import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DecileChart from "./DecileChart";
import BudgetBarChart from "./BudgetBarChart";
import PovertyImpactTable from "./PovertyImpactTable";
import LocalAreaSection from "./LocalAreaSection";
import SFCComparisonTable from "./SFCComparisonTable";
import "./Dashboard.css";
import { POLICY_NAMES, ALL_POLICY_IDS } from "../utils/policyConfig";

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "budgetary-impact", label: "Budgetary impact" },
  { id: "living-standards", label: "Living standards" },
  { id: "poverty", label: "Poverty rate" },
  { id: "constituencies", label: "Impact by constituency" },
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
  scp_inflation: {
    name: "SCP inflation adjustment",
    description: "Scottish Child Payment uprated from £27.15 to £28.20/week",
    explanation: (
      <li>
        <strong>SCP inflation adjustment</strong>: The Budget uprates the Scottish Child Payment
        from £27.15 to £28.20 per week (+3.9% for inflation). This benefits all families receiving
        SCP, providing approximately £55 extra per child per year.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View SCP rates by year</summary>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Weekly rate</th>
                <th style={thRightStyle}>Annual (per child)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£27.15</td><td style={tdRightStyle}>£1,412</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£28.20</td><td style={tdRightStyle}>£1,466</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£28.85</td><td style={tdRightStyle}>£1,500</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£29.45</td><td style={tdRightStyle}>£1,531</td></tr>
              <tr><td style={tdStyle}>2029-30</td><td style={tdRightStyle}>£30.05</td><td style={tdRightStyle}>£1,563</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31</td><td style={{...tdRightStyle, borderBottom: "none"}}>£30.65</td><td style={{...tdRightStyle, borderBottom: "none"}}>£1,594</td></tr>
            </tbody>
          </table>
          <div style={noteStyle}>
            <p style={{ margin: 0 }}>Uprated annually by CPI (September of prior year).</p>
            <p style={{ margin: "8px 0 0 0" }}>Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/" target="_blank" rel="noopener noreferrer">Scottish Budget 2026-27</a> | <a href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-january-2026/" target="_blank" rel="noopener noreferrer">SFC January 2026</a></p>
          </div>
        </details>
      </li>
    ),
  },
  scp_baby_boost: {
    name: "SCP Premium for under-ones",
    description: "Scottish Child Payment raised to £40/week for babies under 1",
    explanation: (
      <li>
        <strong>SCP Premium for under-ones</strong>: The Budget raises the Scottish Child Payment
        to £40 per week for each child under one year old. This is £11.15/week extra on top of the
        standard rate of £28.85/week. Commences 2027-28, subject to parliamentary approval.
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
          <div style={noteStyle}>
            <p style={{ margin: 0 }}>Under-one premium starts 2027-28. Both standard rate and premium uprated by CPI annually.</p>
            <p style={{ margin: "8px 0 0 0" }}>Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/" target="_blank" rel="noopener noreferrer">Scottish Budget 2026-27</a> | <a href="https://www.gov.scot/news/a-budget-to-tackle-child-poverty/" target="_blank" rel="noopener noreferrer">Scottish Government announcement</a></p>
          </div>
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
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Basic rate starts at</th>
                <th style={thCenterStyle}>Change from prior year</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£15,398</td><td style={tdCenterStyle}>—</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£16,538</td><td style={{...tdCenterStyle, color: "#2e7d32"}}>+7.4%</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£16,872</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£17,216</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={tdStyle}>2029-30</td><td style={tdRightStyle}>£17,567</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31</td><td style={{...tdRightStyle, borderBottom: "none"}}>£17,918</td><td style={{...tdCenterStyle, borderBottom: "none"}}>CPI</td></tr>
            </tbody>
          </table>
          <div style={noteStyle}>
            <p style={{ margin: 0 }}>From 2027-28, thresholds projected using OBR CPI forecasts (~2% annually).</p>
            <p style={{ margin: "8px 0 0 0" }}>Source: <a href="https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/" target="_blank" rel="noopener noreferrer">Scottish Government</a> | <a href="https://obr.uk/efo/economic-and-fiscal-outlook-november-2025/" target="_blank" rel="noopener noreferrer">OBR EFO November 2025</a></p>
          </div>
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
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Intermediate rate starts at</th>
                <th style={thCenterStyle}>Change from prior year</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£27,492</td><td style={tdCenterStyle}>—</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£29,527</td><td style={{...tdCenterStyle, color: "#2e7d32"}}>+7.4%</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£30,123</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£30,738</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={tdStyle}>2029-30</td><td style={tdRightStyle}>£31,365</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31</td><td style={{...tdRightStyle, borderBottom: "none"}}>£31,992</td><td style={{...tdCenterStyle, borderBottom: "none"}}>CPI</td></tr>
            </tbody>
          </table>
          <div style={noteStyle}>
            <p style={{ margin: 0 }}>From 2027-28, thresholds projected using OBR CPI forecasts (~2% annually).</p>
            <p style={{ margin: "8px 0 0 0" }}>Source: <a href="https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/" target="_blank" rel="noopener noreferrer">Scottish Government</a> | <a href="https://obr.uk/efo/economic-and-fiscal-outlook-november-2025/" target="_blank" rel="noopener noreferrer">OBR EFO November 2025</a></p>
          </div>
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
        at £43,662 until 2028-29. Without the freeze, this threshold would increase with inflation,
        meaning fewer taxpayers would pay the higher rate. The freeze raises revenue for the Scottish Government.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View higher rate threshold by year</summary>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Higher rate (42%) starts at</th>
                <th style={thCenterStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£43,663</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£43,663</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£43,663</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£43,663</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2029-30*</td><td style={tdRightStyle}>£44,554</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31*</td><td style={{...tdRightStyle, borderBottom: "none"}}>£45,445</td><td style={{...tdCenterStyle, borderBottom: "none"}}>CPI</td></tr>
            </tbody>
          </table>
          <p style={noteStyle}>Freeze confirmed until 2028-29. *2029-30 onwards: PolicyEngine assumption (CPI uprating). Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/3/" target="_blank" rel="noopener noreferrer">Scottish Budget Chapter 2</a> | <a href="https://fiscalcommission.scot/publications/scotlands-economic-and-fiscal-forecasts-january-2026/" target="_blank" rel="noopener noreferrer">SFC January 2026</a></p>
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
        at £75,000 until 2028-29. Without the freeze, this threshold would increase with inflation.
        The freeze raises revenue from higher earners.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View advanced rate threshold by year</summary>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Advanced rate (45%) starts at</th>
                <th style={thCenterStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£75,001</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£75,001</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£75,001</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£75,001</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2029-30*</td><td style={tdRightStyle}>£76,531</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31*</td><td style={{...tdRightStyle, borderBottom: "none"}}>£78,062</td><td style={{...tdCenterStyle, borderBottom: "none"}}>CPI</td></tr>
            </tbody>
          </table>
          <p style={noteStyle}>Freeze confirmed until 2028-29. *2029-30 onwards: PolicyEngine assumption (CPI uprating). Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/3/" target="_blank" rel="noopener noreferrer">Scottish Budget Chapter 2</a></p>
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
        at £125,140 until 2028-29. Without the freeze, this threshold would increase with inflation.
        The freeze raises revenue from the highest earners.
        <details className="policy-table-details" style={{ marginTop: "12px" }}>
          <summary style={summaryStyle}>View top rate threshold by year</summary>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thRightStyle}>Top rate (48%) starts at</th>
                <th style={thCenterStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>2025-26</td><td style={tdRightStyle}>£125,140</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2026-27</td><td style={tdRightStyle}>£125,140</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2027-28</td><td style={tdRightStyle}>£125,140</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2028-29</td><td style={tdRightStyle}>£125,140</td><td style={{...tdCenterStyle, color: "#c62828"}}>Frozen</td></tr>
              <tr><td style={tdStyle}>2029-30*</td><td style={tdRightStyle}>£127,693</td><td style={tdCenterStyle}>CPI</td></tr>
              <tr><td style={{...tdStyle, borderBottom: "none"}}>2030-31*</td><td style={{...tdRightStyle, borderBottom: "none"}}>£130,247</td><td style={{...tdCenterStyle, borderBottom: "none"}}>CPI</td></tr>
            </tbody>
          </table>
          <div style={noteStyle}>
            <p style={{ margin: 0 }}>Freeze confirmed until 2028-29. *2029-30 onwards: PolicyEngine assumption (CPI uprating). Source: <a href="https://www.gov.scot/publications/scottish-budget-2026-2027/pages/3/" target="_blank" rel="noopener noreferrer">Scottish Budget Chapter 2</a></p>
            <p style={{ margin: "4px 0 0 0" }}>Note: £125,140 threshold aligns with UK Personal Allowance taper (allowance fully withdrawn at this income).</p>
          </div>
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

      ALL_POLICY_IDS.forEach(policyId => {
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
  }, [isStacked, rawBudgetaryData]);

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
        netRelative += relValue;
        netAbsolute += absValue;
      });

      dataPoint.netRelative = netRelative;
      dataPoint.netAbsolute = netAbsolute;
      return dataPoint;
    });
  }, [isStacked, rawDistributionalData, selectedYear]);

  // Transform average income change data for stacked chart
  const stackedAvgIncomeData = useMemo(() => {
    if (!isStacked || rawDistributionalData.length === 0) return null;

    const years = [2026, 2027, 2028, 2029, 2030];
    return years.map(year => {
      const dataPoint = { year };
      let netImpact = 0;

      ALL_POLICY_IDS.forEach(policyId => {
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
  }, [isStacked, rawDistributionalData]);

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
            {POLICY_INFO.income_tax_basic_uplift.explanation}
            {POLICY_INFO.income_tax_intermediate_uplift.explanation}
            {POLICY_INFO.scp_inflation.explanation}
            {POLICY_INFO.scp_baby_boost.explanation}
            {POLICY_INFO.higher_rate_freeze.explanation}
            {POLICY_INFO.advanced_rate_freeze.explanation}
            {POLICY_INFO.top_rate_freeze.explanation}
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
          description={`Estimated annual cost of the ${policyInfo.name} policy in Scotland.`}
          tooltipLabel="Cost"
        />
      )}

      {/* SFC Comparison Table */}
      <SFCComparisonTable />

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
        </p>
        {isStacked && stackedAvgIncomeData ? (
          <BudgetBarChart
            data={stackedAvgIncomeData}
            yLabel="Average income change (£)"
            yFormat={(v) => `£${v.toFixed(2)}`}
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
            yFormat={(v) => `£${v.toFixed(2)}`}
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
              : "Combined impact of selected policies across income deciles. SCP policies target lower income families, income tax threshold uplifts benefit middle deciles, and threshold freezes affect higher earners."
          }
          stacked={isStacked}
          stackedData={stackedDecileData}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableYears={AVAILABLE_YEARS}
          selectedPolicies={selectedPolicies}
        />
      ) : null}

      {/* Poverty Section */}
      <h2 className="section-title" id="poverty" ref={(el) => (sectionRefs.current["poverty"] = el)}>Poverty rate</h2>
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
