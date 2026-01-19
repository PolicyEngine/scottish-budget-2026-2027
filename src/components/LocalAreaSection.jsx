import { useState, useEffect, useMemo } from "react";
import ScotlandMap from "./ScotlandMap";
import "./LocalAreaSection.css";

// Parse CSV text into array of objects (handles quoted values with commas)
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx]?.trim();
    });
    data.push(row);
  }
  return data;
}

// Parse a single CSV line, handling quoted values with commas
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Get region for a local authority (simplified - returns Scotland for now)
function getRegion(localAuthorityName) {
  return "Scotland";
}

const POLICY_DISPLAY_NAMES = {
  combined: "both policies",
  scp_baby_boost: "SCP Premium for under-ones",
  income_tax_threshold_uplift: "income tax threshold uplift",
};

export default function LocalAreaSection({
  selectedPolicy = "scp_baby_boost",
  selectedYear = 2026,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
}) {
  const policyName = POLICY_DISPLAY_NAMES[selectedPolicy] || "the selected policy";
  const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;

  const [localAuthorityData, setLocalAuthorityData] = useState([]);
  const [selectedLocalAuthority, setSelectedLocalAuthority] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("All regions");
  const [loading, setLoading] = useState(true);
  const [showTop, setShowTop] = useState(true); // Toggle for Top 10 vs Lowest 10

  // Load local authority data from CSV
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/data/local_authorities.csv");
        if (res.ok) {
          const csvText = await res.text();
          const data = parseCSV(csvText);

          // Transform to expected format and add region (filter by year and selected policy)
          const transformed = data
            .filter(row =>
              row.local_authority_code?.startsWith("S") &&
              row.year === String(selectedYear) &&
              row.reform_id === selectedPolicy
            )
            .map(row => ({
              code: row.local_authority_code,
              name: row.local_authority_name,
              avgGain: parseFloat(row.average_gain) || 0,
              relativeChange: parseFloat(row.relative_change) || 0,
              region: getRegion(row.local_authority_name),
              // Estimate poverty reduction from relative change (placeholder)
              povertyReduction: Math.max(0, (parseFloat(row.relative_change) || 0) * 1.5),
              households: 40000, // Placeholder
            }));

          setLocalAuthorityData(transformed);
        }
      } catch (err) {
        console.warn("Error loading local authority data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedPolicy, selectedYear]);

  // Convert local authority data for the map component
  const mapLocalAuthorityData = useMemo(() => {
    return localAuthorityData.map(c => ({
      local_authority_code: c.code,
      local_authority_name: c.name,
      average_gain: c.avgGain,
      relative_change: c.relativeChange,
      households: c.households,
      povertyReduction: parseFloat(c.povertyReduction),
    }));
  }, [localAuthorityData]);

  // Handle local authority selection from map
  const handleLocalAuthoritySelect = (laData) => {
    if (laData) {
      const fullData = localAuthorityData.find(c => c.code === laData.code);
      setSelectedLocalAuthority(fullData || null);
    } else {
      setSelectedLocalAuthority(null);
    }
  };

  // Get unique regions
  const regions = useMemo(() => {
    const uniqueRegions = [...new Set(localAuthorityData.map(c => c.region))];
    return ["All regions", ...uniqueRegions.sort()];
  }, [localAuthorityData]);

  // Filter local authorities by region
  const filteredLocalAuthorities = useMemo(() => {
    let filtered = [...localAuthorityData];
    if (selectedRegion !== "All regions") {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }
    return filtered.sort((a, b) => b.avgGain - a.avgGain);
  }, [localAuthorityData, selectedRegion]);

  // Prepare list data - Top 10 or Lowest 10 local authorities
  const chartData = useMemo(() => {
    const sorted = [...localAuthorityData].sort((a, b) => b.avgGain - a.avgGain);
    if (showTop) {
      return sorted.slice(0, 10);
    } else {
      return sorted.slice(-10).reverse();
    }
  }, [localAuthorityData, showTop]);

  if (loading) {
    return <div className="local-area-section"><p>Loading local authority data...</p></div>;
  }

  // Show message if no local authority data for this policy
  if (localAuthorityData.length === 0) {
    return (
      <div className="local-area-section">
        <div className="section-box">
          <p className="chart-description">
            Local authority-level data is not yet available for this policy reform.
            {selectedPolicy === "income_tax_threshold_uplift" && (
              <> The income tax threshold uplift affects taxpayers across Scotland relatively uniformly,
              with minor variations based on local income distributions.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="local-area-section">
      {/* Interactive Map */}
      <div className="section-box map-section">
        <ScotlandMap
          localAuthorityData={mapLocalAuthorityData}
          selectedYear={selectedYear}
          onYearChange={onYearChange}
          availableYears={availableYears}
          selectedLocalAuthority={selectedLocalAuthority ? { code: selectedLocalAuthority.code, name: selectedLocalAuthority.name } : null}
          onLocalAuthoritySelect={handleLocalAuthoritySelect}
          policyName={policyName}
        />
      </div>

      {/* Selected Local Authority Details */}
      {selectedLocalAuthority && (
        <div className="section-box">
          <h3 className="chart-title">Selected local authority</h3>
          <div className="local-authority-details">
            <h4 className="local-authority-name">{selectedLocalAuthority.name}</h4>
            <p className="local-authority-region">{selectedLocalAuthority.region}</p>
            <div className="local-authority-metrics">
              <div className="metric-card">
                <span className="metric-label">Average household gain</span>
                <span className="metric-value">£{selectedLocalAuthority.avgGain.toFixed(2)}/year</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Poverty rate reduction</span>
                <span className="metric-value">{selectedLocalAuthority.povertyReduction.toFixed(3)}pp</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local Authority Comparison - Top/Lowest 10 */}
      <div className="section-box">
        <h3 className="chart-title">Local authority comparison</h3>
        <p className="chart-description">
          {showTop ? "Highest" : "Lowest"} average household gain by local authority from the {policyName} policy in {formatYearRange(selectedYear)}.
        </p>
        <div className="local-authority-controls-bar">
          <div className="control-group">
            <span className="control-label">Show:</span>
            <div className="chart-toggle">
              <button
                className={`toggle-btn ${showTop ? "active" : ""}`}
                onClick={() => setShowTop(true)}
              >
                Top 10
              </button>
              <button
                className={`toggle-btn ${!showTop ? "active" : ""}`}
                onClick={() => setShowTop(false)}
              >
                Lowest 10
              </button>
            </div>
          </div>
          {onYearChange && (
            <div className="control-group">
              <span className="control-label">Year:</span>
              <div className="year-toggle">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    className={selectedYear === year ? "active" : ""}
                    onClick={() => onYearChange(year)}
                  >
                    {formatYearRange(year)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <ol className="local-authority-list">
          {chartData.map((c, index) => (
            <li key={c.code} className="local-authority-list-item">
              <span className="local-authority-list-name">{c.name}</span>
              <span className={`local-authority-list-value ${c.avgGain >= 0 ? "positive" : "negative"}`}>
                £{c.avgGain.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
