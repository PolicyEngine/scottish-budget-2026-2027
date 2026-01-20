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

const POLICY_DISPLAY_NAMES = {
  scp_baby_boost: "SCP Premium for under-ones",
  scp_inflation: "SCP inflation adjustment",
  income_tax_basic_uplift: "basic rate threshold uplift",
  income_tax_intermediate_uplift: "intermediate rate threshold uplift",
};

export default function LocalAreaSection({
  selectedPolicies = [],
  selectedYear = 2026,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
}) {
  // Generate policy name for display
  const policyName = selectedPolicies.length === 1
    ? POLICY_DISPLAY_NAMES[selectedPolicies[0]] || "the selected policy"
    : selectedPolicies.length > 1
    ? "selected policies"
    : "the selected policy";
  const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;

  const [rawLocalAuthorityData, setRawLocalAuthorityData] = useState([]);
  const [selectedLocalAuthority, setSelectedLocalAuthority] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTop, setShowTop] = useState(true); // Toggle for Top 10 vs Lowest 10

  // Load ALL local authority data from CSV (once)
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/data/local_authorities.csv");
        if (res.ok) {
          const csvText = await res.text();
          const data = parseCSV(csvText);

          // Transform to expected format (load all Scottish local authorities)
          const transformed = data
            .filter(row => row.local_authority_code?.startsWith("S"))
            .map(row => ({
              reform_id: row.reform_id,
              year: parseInt(row.year),
              code: row.local_authority_code,
              name: row.local_authority_name,
              avgGain: parseFloat(row.average_gain) || 0,
              relativeChange: parseFloat(row.relative_change) || 0,
            }));

          setRawLocalAuthorityData(transformed);
        }
      } catch (err) {
        console.warn("Error loading local authority data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Aggregate data across selected policies (dynamically sum)
  const localAuthorityData = useMemo(() => {
    if (!rawLocalAuthorityData.length || !selectedPolicies.length) return [];

    // Group by local authority and sum values across selected policies
    const laMap = new Map();

    rawLocalAuthorityData.forEach((row) => {
      if (!selectedPolicies.includes(row.reform_id)) return;
      if (row.year !== selectedYear) return;

      const key = row.code;
      if (!laMap.has(key)) {
        laMap.set(key, {
          code: row.code,
          name: row.name,
          avgGain: 0,
          relativeChange: 0,
          policyBreakdown: {},
          households: 40000, // Placeholder
        });
      }

      const existing = laMap.get(key);
      existing.avgGain += row.avgGain;
      existing.relativeChange += row.relativeChange;

      // Store individual policy contribution for tooltip
      existing.policyBreakdown[row.reform_id] = {
        avgGain: row.avgGain,
        relativeChange: row.relativeChange,
      };
    });

    // Convert to array and add poverty reduction estimate
    return Array.from(laMap.values()).map(la => ({
      ...la,
      povertyReduction: Math.max(0, la.relativeChange * 1.5),
    }));
  }, [rawLocalAuthorityData, selectedPolicies, selectedYear]);

  // Convert local authority data for the map component
  const mapLocalAuthorityData = useMemo(() => {
    return localAuthorityData.map(la => ({
      local_authority_code: la.code,
      local_authority_name: la.name,
      average_gain: la.avgGain,
      relative_change: la.relativeChange,
      households: la.households,
      povertyReduction: parseFloat(la.povertyReduction),
      policyBreakdown: la.policyBreakdown,
    }));
  }, [localAuthorityData]);

  // Handle local authority selection from map
  const handleLocalAuthoritySelect = (laData) => {
    if (laData) {
      const fullData = localAuthorityData.find(la => la.code === laData.code);
      setSelectedLocalAuthority(fullData || null);
    } else {
      setSelectedLocalAuthority(null);
    }
  };

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

  // Show message if no policies selected or no data
  if (selectedPolicies.length === 0) {
    return (
      <div className="local-area-section">
        <div className="section-box">
          <p className="chart-description">
            Select at least one policy to see local authority impacts.
          </p>
        </div>
      </div>
    );
  }

  if (localAuthorityData.length === 0) {
    return (
      <div className="local-area-section">
        <div className="section-box">
          <p className="chart-description">
            Local authority data is not yet available for the selected policies.
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
          selectedPolicies={selectedPolicies}
        />
      </div>

      {/* Selected Local Authority Details */}
      {selectedLocalAuthority && (
        <div className="section-box">
          <h3 className="chart-title">Selected local authority</h3>
          <div className="local-authority-details">
            <h4 className="local-authority-name">{selectedLocalAuthority.name}</h4>
            <div className="local-authority-metrics">
              <div className="metric-card">
                <span className="metric-label">Average household gain</span>
                <span className="metric-value">£{selectedLocalAuthority.avgGain.toFixed(2)}/year</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Poverty rate reduction</span>
                <span className="metric-value">{selectedLocalAuthority.povertyReduction.toFixed(2)}pp</span>
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
          {chartData.map((la) => (
            <li key={la.code} className="local-authority-list-item">
              <span className="local-authority-list-name">{la.name}</span>
              <span className={`local-authority-list-value ${la.avgGain >= 0 ? "positive" : "negative"}`}>
                £{la.avgGain.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
