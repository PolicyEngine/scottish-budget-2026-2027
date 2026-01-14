import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

const POLICY_NAMES = {
  scp_baby_boost: "SCP baby boost",
  income_tax_threshold_uplift: "income tax threshold uplift",
};

export default function LocalAreaSection({ selectedPolicy = "scp_baby_boost" }) {
  const policyName = POLICY_NAMES[selectedPolicy] || "the selected policy";
  const [constituencyData, setConstituencyData] = useState([]);
  const [selectedConstituency, setSelectedConstituency] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("All regions");
  const [loading, setLoading] = useState(true);

  // Load constituency data from CSV
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/data/constituency.csv");
        if (res.ok) {
          const csvText = await res.text();
          const data = parseCSV(csvText);

          // Transform to expected format and add region (filter to 2026 data and selected policy)
          const transformed = data
            .filter(row =>
              row.constituency_code?.startsWith("S") &&
              row.year === "2026" &&
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
  }, [selectedPolicy]);

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

  // Prepare chart data for regional comparison
  const regionalData = useMemo(() => {
    const regionStats = {};
    constituencyData.forEach(c => {
      if (!regionStats[c.region]) {
        regionStats[c.region] = { region: c.region, totalGain: 0, count: 0 };
      }
      regionStats[c.region].totalGain += c.avgGain;
      regionStats[c.region].count += 1;
    });
    return Object.values(regionStats).map(r => ({
      region: r.region.replace("and ", "& "),
      avgGain: parseFloat((r.totalGain / r.count).toFixed(2)),
    })).sort((a, b) => b.avgGain - a.avgGain);
  }, [constituencyData]);

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
          selectedYear={2026}
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
                <span className="metric-value">{selectedConstituency.povertyReduction.toFixed(3)}pp</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Constituencies Comparison */}
      <div className="section-box">
        <h3 className="chart-title">Constituency comparison</h3>
        <p className="chart-description">
          Average household gain by constituency from the {policyName} policy. All {filteredConstituencies.length} Scottish constituencies sorted by impact.
        </p>
        <div className="constituency-chart-container">
          <ResponsiveContainer width="100%" height={filteredConstituencies.length * 22 + 40}>
            <BarChart data={filteredConstituencies} layout="vertical" margin={{ top: 10, right: 30, left: 200, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" tickFormatter={(v) => `£${v.toFixed(0)}`} />
              <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 10 }} interval={0} />
              <Tooltip formatter={(value) => [`£${value.toFixed(2)}`, "Avg. gain"]} />
              <Bar dataKey="avgGain" fill="#319795" name="Avg. gain" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
