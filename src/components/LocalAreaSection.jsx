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

// Scottish regions mapping (names must match CSV exactly, including commas)
const REGION_MAPPING = {
  "Glasgow": ["Glasgow East", "Glasgow North", "Glasgow North East", "Glasgow South", "Glasgow South West", "Glasgow West", "Rutherglen"],
  "Lothian": ["Edinburgh East and Musselburgh", "Edinburgh North and Leith", "Edinburgh South", "Edinburgh South West", "Edinburgh West", "Lothian East", "Midlothian", "Livingston", "Bathgate and Linlithgow"],
  "Central Scotland": ["Airdrie and Shotts", "Coatbridge and Bellshill", "Cumbernauld and Kirkintilloch", "East Kilbride and Strathaven", "Falkirk", "Hamilton and Clyde Valley", "Motherwell, Wishaw and Carluke"],
  "West Scotland": ["Dumbarton", "Inverclyde and Renfrewshire West", "Mid Dunbartonshire", "Paisley and Renfrewshire North", "Paisley and Renfrewshire South", "West Dunbartonshire", "East Renfrewshire"],
  "South Scotland": ["Ayr, Carrick and Cumnock", "Central Ayrshire", "Dumfriesshire, Clydesdale and Tweeddale", "Kilmarnock and Loudoun", "North Ayrshire and Arran", "Dumfries and Galloway", "Berwickshire, Roxburgh and Selkirk"],
  "Mid Scotland and Fife": ["Alloa and Grangemouth", "Cowdenbeath and Kirkcaldy", "Dunfermline and Dollar", "Glenrothes and Mid Fife", "North East Fife", "Perth and Kinross-shire", "Stirling and Strathallan"],
  "North East Scotland": ["Aberdeen North", "Aberdeen South", "Aberdeenshire North and Moray East", "Angus and Perthshire Glens", "Arbroath and Broughty Ferry", "Dundee Central", "Gordon and Buchan", "West Aberdeenshire and Kincardine"],
  "Highlands and Islands": ["Argyll, Bute and South Lochaber", "Caithness, Sutherland and Easter Ross", "Inverness, Skye and West Ross-shire", "Moray West, Nairn and Strathspey", "Na h-Eileanan an Iar", "Orkney and Shetland"],
};

// Get region for a constituency
function getRegion(constituencyName) {
  for (const [region, constituencies] of Object.entries(REGION_MAPPING)) {
    if (constituencies.some(c => constituencyName.includes(c) || c.includes(constituencyName))) {
      return region;
    }
  }
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

  const [constituencyData, setConstituencyData] = useState([]);
  const [selectedConstituency, setSelectedConstituency] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("All regions");
  const [loading, setLoading] = useState(true);
  const [showTop, setShowTop] = useState(true); // Toggle for Top 10 vs Lowest 10

  // Load constituency data from CSV
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/data/constituency.csv");
        if (res.ok) {
          const csvText = await res.text();
          const data = parseCSV(csvText);

          // Transform to expected format and add region (filter by year and selected policy)
          const transformed = data
            .filter(row =>
              row.constituency_code?.startsWith("S") &&
              row.year === String(selectedYear) &&
              row.reform_id === selectedPolicy
            )
            .map(row => ({
              code: row.constituency_code,
              name: row.constituency_name,
              avgGain: parseFloat(row.average_gain) || 0,
              relativeChange: parseFloat(row.relative_change) || 0,
              region: getRegion(row.constituency_name),
              // Estimate poverty reduction from relative change (placeholder)
              povertyReduction: Math.max(0, (parseFloat(row.relative_change) || 0) * 1.5),
              households: 40000, // Placeholder
            }));

          setConstituencyData(transformed);
        }
      } catch (err) {
        console.warn("Error loading constituency data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedPolicy, selectedYear]);

  // Convert constituency data for the map component
  const mapConstituencyData = useMemo(() => {
    return constituencyData.map(c => ({
      constituency_code: c.code,
      constituency_name: c.name,
      average_gain: c.avgGain,
      relative_change: c.relativeChange,
      households: c.households,
      povertyReduction: parseFloat(c.povertyReduction),
    }));
  }, [constituencyData]);

  // Handle constituency selection from map
  const handleConstituencySelect = (constData) => {
    if (constData) {
      const fullData = constituencyData.find(c => c.code === constData.code);
      setSelectedConstituency(fullData || null);
    } else {
      setSelectedConstituency(null);
    }
  };

  // Get unique regions
  const regions = useMemo(() => {
    const uniqueRegions = [...new Set(constituencyData.map(c => c.region))];
    return ["All regions", ...uniqueRegions.sort()];
  }, [constituencyData]);

  // Filter constituencies by region
  const filteredConstituencies = useMemo(() => {
    let filtered = [...constituencyData];
    if (selectedRegion !== "All regions") {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }
    return filtered.sort((a, b) => b.avgGain - a.avgGain);
  }, [constituencyData, selectedRegion]);

  // Prepare list data - Top 10 or Lowest 10 constituencies
  const chartData = useMemo(() => {
    const sorted = [...constituencyData].sort((a, b) => b.avgGain - a.avgGain);
    if (showTop) {
      return sorted.slice(0, 10);
    } else {
      return sorted.slice(-10).reverse();
    }
  }, [constituencyData, showTop]);

  if (loading) {
    return <div className="local-area-section"><p>Loading constituency data...</p></div>;
  }

  // Show message if no constituency data for this policy
  if (constituencyData.length === 0) {
    return (
      <div className="local-area-section">
        <div className="section-box">
          <p className="chart-description">
            Constituency-level data is not yet available for this policy reform.
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
          constituencyData={mapConstituencyData}
          selectedYear={selectedYear}
          onYearChange={onYearChange}
          availableYears={availableYears}
          selectedConstituency={selectedConstituency ? { code: selectedConstituency.code, name: selectedConstituency.name } : null}
          onConstituencySelect={handleConstituencySelect}
          policyName={policyName}
        />
      </div>

      {/* Selected Constituency Details */}
      {selectedConstituency && (
        <div className="section-box">
          <h3 className="chart-title">Selected constituency</h3>
          <div className="constituency-details">
            <h4 className="constituency-name">{selectedConstituency.name}</h4>
            <p className="constituency-region">{selectedConstituency.region}</p>
            <div className="constituency-metrics">
              <div className="metric-card">
                <span className="metric-label">Average household gain</span>
                <span className="metric-value">£{selectedConstituency.avgGain.toFixed(2)}/year</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Poverty rate reduction</span>
                <span className="metric-value">{selectedConstituency.povertyReduction.toFixed(2)}pp
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Constituency Comparison - Top/Lowest 10 */}
      <div className="section-box">
        <h3 className="chart-title">Constituency comparison</h3>
        <p className="chart-description">
          {showTop ? "Highest" : "Lowest"} average household gain by constituency from the {policyName} policy in {formatYearRange(selectedYear)}.
        </p>
        <div className="constituency-controls-bar">
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
        <ol className="constituency-list">
          {chartData.map((c, index) => (
            <li key={c.code} className="constituency-list-item">
              <span className="constituency-list-name">{c.name}</span>
              <span className={`constituency-list-value ${c.avgGain >= 0 ? "positive" : "negative"}`}>
                £{c.avgGain.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
