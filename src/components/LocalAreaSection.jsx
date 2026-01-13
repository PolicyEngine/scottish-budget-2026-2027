import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ScotlandMap from "./ScotlandMap";
import "./LocalAreaSection.css";

// Parse CSV text into array of objects
function parseCSV(csvText) {
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
}

// Scottish regions mapping
const REGION_MAPPING = {
  "Glasgow": ["Glasgow East", "Glasgow North", "Glasgow North East", "Glasgow South", "Glasgow South West", "Glasgow West", "Rutherglen"],
  "Lothian": ["Edinburgh East and Musselburgh", "Edinburgh North and Leith", "Edinburgh South", "Edinburgh South West", "Edinburgh West", "Lothian East", "Midlothian", "Livingston", "Bathgate and Linlithgow"],
  "Central Scotland": ["Airdrie and Shotts", "Coatbridge and Bellshill", "Cumbernauld and Kirkintilloch", "East Kilbride and Strathaven", "Falkirk", "Hamilton and Clyde Valley", "Motherwell Wishaw and Carluke"],
  "West Scotland": ["Dumbarton", "Inverclyde and Renfrewshire West", "Mid Dunbartonshire", "Paisley and Renfrewshire North", "Paisley and Renfrewshire South", "West Dunbartonshire"],
  "South Scotland": ["Ayr Carrick and Cumnock", "Central Ayrshire", "Dumfriesshire Clydesdale and Tweeddale", "Kilmarnock and Loudoun", "North Ayrshire and Arran"],
  "Mid Scotland and Fife": ["Alloa and Grangemouth", "Cowdenbeath and Kirkcaldy", "Dunfermline and Dollar", "Glenrothes and Mid Fife", "North East Fife", "Perth and Kinross-shire", "Stirling and Strathallan"],
  "North East Scotland": ["Aberdeen North", "Aberdeen South", "Aberdeenshire North and Moray East", "Angus and Perthshire Glens", "Arbroath and Broughty Ferry", "Dundee Central", "Gordon and Buchan", "West Aberdeenshire and Kincardine"],
  "Highlands and Islands": ["Argyll Bute and South Lochaber", "Caithness Sutherland and Easter Ross", "Inverness Skye and West Ross-shire", "Moray West Nairn and Strathspey", "Na h-Eileanan an Iar", "Orkney and Shetland"],
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

export default function LocalAreaSection() {
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

          // Transform to expected format and add region
          const transformed = data
            .filter(row => row.constituency_code?.startsWith("S"))
            .map(row => ({
              code: row.constituency_code,
              name: row.constituency_name,
              avgGain: parseFloat(row.average_gain) || 0,
              relativeChange: parseFloat(row.relative_change) || 0,
              region: getRegion(row.constituency_name),
              // Estimate poverty reduction from relative change (placeholder)
              povertyReduction: Math.max(0, (parseFloat(row.relative_change) || 0) * 1.5).toFixed(1),
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
  }, []);

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
      avgGain: Math.round(r.totalGain / r.count),
    })).sort((a, b) => b.avgGain - a.avgGain);
  }, [constituencyData]);

  // Top and bottom constituencies
  const topConstituencies = useMemo(() => {
    return [...constituencyData].sort((a, b) => b.avgGain - a.avgGain).slice(0, 5);
  }, [constituencyData]);

  const bottomConstituencies = useMemo(() => {
    return [...constituencyData].sort((a, b) => a.avgGain - b.avgGain).slice(0, 5);
  }, [constituencyData]);

  if (loading) {
    return <div className="local-area-section"><p>Loading constituency data...</p></div>;
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
                <span className="metric-value">£{selectedConstituency.avgGain}/year</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Relative change</span>
                <span className="metric-value">+{selectedConstituency.relativeChange.toFixed(2)}%</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Poverty reduction</span>
                <span className="metric-value">{selectedConstituency.povertyReduction}pp</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regional Comparison Chart */}
      <div className="section-box">
        <h3 className="chart-title">Regional comparison</h3>
        <p className="chart-description">
          Average household gain by Scottish region. Urban areas like Glasgow see larger gains due to
          higher concentrations of households affected by the two-child limit.
        </p>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={regionalData} layout="vertical" margin={{ top: 20, right: 30, left: 150, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" tickFormatter={(v) => `£${v}`} />
              <YAxis type="category" dataKey="region" width={140} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`£${value}`, "Avg. gain"]}
              />
              <Bar dataKey="avgGain" fill="#319795" name="Avg. gain" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top and Bottom Constituencies */}
      <div className="charts-row">
        <div className="section-box">
          <h3 className="chart-title">Highest impact constituencies</h3>
          <p className="chart-description">
            Constituencies with the largest average household gains from the two-child limit abolition.
          </p>
          <div className="constituency-list">
            {topConstituencies.map((c, i) => (
              <div
                key={c.code}
                className={`constituency-item ${selectedConstituency?.code === c.code ? 'selected' : ''}`}
                onClick={() => handleConstituencySelect({ code: c.code, name: c.name })}
              >
                <span className="rank">{i + 1}</span>
                <div className="constituency-info">
                  <span className="name">{c.name}</span>
                  <span className="region">{c.region}</span>
                </div>
                <span className="gain">£{c.avgGain}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-box">
          <h3 className="chart-title">Lowest impact constituencies</h3>
          <p className="chart-description">
            Constituencies with the smallest average household gains from the two-child limit abolition.
          </p>
          <div className="constituency-list">
            {bottomConstituencies.map((c, i) => (
              <div
                key={c.code}
                className={`constituency-item ${selectedConstituency?.code === c.code ? 'selected' : ''}`}
                onClick={() => handleConstituencySelect({ code: c.code, name: c.name })}
              >
                <span className="rank">{constituencyData.length - 4 + i}</span>
                <div className="constituency-info">
                  <span className="name">{c.name}</span>
                  <span className="region">{c.region}</span>
                </div>
                <span className="gain">£{c.avgGain}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
