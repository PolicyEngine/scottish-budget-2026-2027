import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ScotlandMap from "./ScotlandMap";
import "./LocalAreaSection.css";

// Scottish constituencies with sample data (with GSS codes for map)
const SCOTTISH_CONSTITUENCIES = [
  { code: "S14000001", name: "Aberdeen North", region: "North East Scotland", households: 42000, avgGain: 320, povertyReduction: 1.2 },
  { code: "S14000002", name: "Aberdeen South", region: "North East Scotland", households: 44000, avgGain: 280, povertyReduction: 0.9 },
  { code: "S14000058", name: "Aberdeenshire North and Moray East", region: "North East Scotland", households: 48000, avgGain: 295, povertyReduction: 1.0 },
  { code: "S14000003", name: "Airdrie and Shotts", region: "Central Scotland", households: 39000, avgGain: 410, povertyReduction: 1.8 },
  { code: "S14000059", name: "Alloa and Grangemouth", region: "Mid Scotland and Fife", households: 41000, avgGain: 355, povertyReduction: 1.4 },
  { code: "S14000004", name: "Angus and Perthshire Glens", region: "North East Scotland", households: 46000, avgGain: 265, povertyReduction: 0.8 },
  { code: "S14000060", name: "Arbroath and Broughty Ferry", region: "North East Scotland", households: 43000, avgGain: 340, povertyReduction: 1.3 },
  { code: "S14000005", name: "Argyll, Bute and South Lochaber", region: "Highlands and Islands", households: 38000, avgGain: 290, povertyReduction: 1.0 },
  { code: "S14000006", name: "Ayr, Carrick and Cumnock", region: "South Scotland", households: 40000, avgGain: 380, povertyReduction: 1.5 },
  { code: "S14000061", name: "Bathgate and Linlithgow", region: "Lothian", households: 45000, avgGain: 310, povertyReduction: 1.1 },
  { code: "S14000008", name: "Caithness, Sutherland and Easter Ross", region: "Highlands and Islands", households: 35000, avgGain: 305, povertyReduction: 1.2 },
  { code: "S14000009", name: "Central Ayrshire", region: "South Scotland", households: 41000, avgGain: 395, povertyReduction: 1.6 },
  { code: "S14000010", name: "Coatbridge and Bellshill", region: "Central Scotland", households: 42000, avgGain: 425, povertyReduction: 1.9 },
  { code: "S14000062", name: "Cowdenbeath and Kirkcaldy", region: "Mid Scotland and Fife", households: 44000, avgGain: 385, povertyReduction: 1.5 },
  { code: "S14000011", name: "Cumbernauld and Kirkintilloch", region: "Central Scotland", households: 43000, avgGain: 350, povertyReduction: 1.3 },
  { code: "S14000063", name: "Dumbarton", region: "West Scotland", households: 39000, avgGain: 365, povertyReduction: 1.4 },
  { code: "S14000013", name: "Dumfriesshire, Clydesdale and Tweeddale", region: "South Scotland", households: 37000, avgGain: 285, povertyReduction: 0.9 },
  { code: "S14000014", name: "Dundee Central", region: "North East Scotland", households: 38000, avgGain: 430, povertyReduction: 2.0 },
  { code: "S14000015", name: "Dunfermline and Dollar", region: "Mid Scotland and Fife", households: 47000, avgGain: 295, povertyReduction: 1.0 },
  { code: "S14000016", name: "East Kilbride and Strathaven", region: "Central Scotland", households: 45000, avgGain: 340, povertyReduction: 1.2 },
  { code: "S14000018", name: "Edinburgh East and Musselburgh", region: "Lothian", households: 48000, avgGain: 375, povertyReduction: 1.4 },
  { code: "S14000019", name: "Edinburgh North and Leith", region: "Lothian", households: 52000, avgGain: 345, povertyReduction: 1.2 },
  { code: "S14000020", name: "Edinburgh South", region: "Lothian", households: 46000, avgGain: 260, povertyReduction: 0.7 },
  { code: "S14000021", name: "Edinburgh South West", region: "Lothian", households: 49000, avgGain: 285, povertyReduction: 0.9 },
  { code: "S14000022", name: "Edinburgh West", region: "Lothian", households: 47000, avgGain: 250, povertyReduction: 0.6 },
  { code: "S14000023", name: "Falkirk", region: "Central Scotland", households: 43000, avgGain: 365, povertyReduction: 1.4 },
  { code: "S14000024", name: "Glasgow East", region: "Glasgow", households: 41000, avgGain: 485, povertyReduction: 2.4 },
  { code: "S14000025", name: "Glasgow North", region: "Glasgow", households: 44000, avgGain: 440, povertyReduction: 2.1 },
  { code: "S14000026", name: "Glasgow North East", region: "Glasgow", households: 40000, avgGain: 510, povertyReduction: 2.6 },
  { code: "S14000027", name: "Glasgow South", region: "Glasgow", households: 45000, avgGain: 395, povertyReduction: 1.7 },
  { code: "S14000028", name: "Glasgow South West", region: "Glasgow", households: 42000, avgGain: 470, povertyReduction: 2.3 },
  { code: "S14000029", name: "Glasgow West", region: "Glasgow", households: 43000, avgGain: 365, povertyReduction: 1.5 },
  { code: "S14000030", name: "Glenrothes and Mid Fife", region: "Mid Scotland and Fife", households: 42000, avgGain: 375, povertyReduction: 1.5 },
  { code: "S14000031", name: "Gordon and Buchan", region: "North East Scotland", households: 47000, avgGain: 255, povertyReduction: 0.7 },
  { code: "S14000064", name: "Hamilton and Clyde Valley", region: "Central Scotland", households: 44000, avgGain: 405, povertyReduction: 1.7 },
  { code: "S14000033", name: "Inverclyde and Renfrewshire West", region: "West Scotland", households: 40000, avgGain: 390, povertyReduction: 1.6 },
  { code: "S14000034", name: "Inverness, Skye and West Ross-shire", region: "Highlands and Islands", households: 43000, avgGain: 310, povertyReduction: 1.1 },
  { code: "S14000035", name: "Kilmarnock and Loudoun", region: "South Scotland", households: 41000, avgGain: 400, povertyReduction: 1.7 },
  { code: "S14000037", name: "Livingston", region: "Lothian", households: 46000, avgGain: 335, povertyReduction: 1.2 },
  { code: "S14000065", name: "Lothian East", region: "Lothian", households: 50000, avgGain: 270, povertyReduction: 0.8 },
  { code: "S14000066", name: "Mid Dunbartonshire", region: "West Scotland", households: 44000, avgGain: 325, povertyReduction: 1.1 },
  { code: "S14000039", name: "Midlothian", region: "Lothian", households: 44000, avgGain: 325, povertyReduction: 1.1 },
  { code: "S14000040", name: "Moray West, Nairn and Strathspey", region: "Highlands and Islands", households: 40000, avgGain: 285, povertyReduction: 0.9 },
  { code: "S14000041", name: "Motherwell, Wishaw and Carluke", region: "Central Scotland", households: 46000, avgGain: 420, povertyReduction: 1.8 },
  { code: "S14000042", name: "Na h-Eileanan an Iar", region: "Highlands and Islands", households: 12000, avgGain: 295, povertyReduction: 1.0 },
  { code: "S14000043", name: "North Ayrshire and Arran", region: "South Scotland", households: 38000, avgGain: 385, povertyReduction: 1.6 },
  { code: "S14000044", name: "North East Fife", region: "Mid Scotland and Fife", households: 41000, avgGain: 260, povertyReduction: 0.7 },
  { code: "S14000045", name: "Orkney and Shetland", region: "Highlands and Islands", households: 22000, avgGain: 275, povertyReduction: 0.8 },
  { code: "S14000046", name: "Paisley and Renfrewshire North", region: "West Scotland", households: 43000, avgGain: 360, povertyReduction: 1.4 },
  { code: "S14000047", name: "Paisley and Renfrewshire South", region: "West Scotland", households: 41000, avgGain: 405, povertyReduction: 1.7 },
  { code: "S14000048", name: "Perth and Kinross-shire", region: "Mid Scotland and Fife", households: 45000, avgGain: 265, povertyReduction: 0.8 },
  { code: "S14000050", name: "Rutherglen", region: "Glasgow", households: 42000, avgGain: 390, povertyReduction: 1.6 },
  { code: "S14000051", name: "Stirling and Strathallan", region: "Mid Scotland and Fife", households: 44000, avgGain: 290, povertyReduction: 0.9 },
  { code: "S14000054", name: "West Aberdeenshire and Kincardine", region: "North East Scotland", households: 46000, avgGain: 245, povertyReduction: 0.6 },
  { code: "S14000055", name: "West Dunbartonshire", region: "West Scotland", households: 39000, avgGain: 420, povertyReduction: 1.9 },
];

// Scottish regions for grouping
const SCOTTISH_REGIONS = [
  "All regions",
  "Central Scotland",
  "Glasgow",
  "Highlands and Islands",
  "Lothian",
  "Mid Scotland and Fife",
  "North East Scotland",
  "South Scotland",
  "West Scotland",
];

export default function LocalAreaSection() {
  const [selectedConstituency, setSelectedConstituency] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("All regions");

  // Convert constituency data for the map component
  const mapConstituencyData = useMemo(() => {
    return SCOTTISH_CONSTITUENCIES.map(c => ({
      constituency_code: c.code,
      constituency_name: c.name,
      average_gain: c.avgGain,
      relative_change: (c.avgGain / 350) * 0.8, // Approximate relative change
      households: c.households,
      povertyReduction: c.povertyReduction,
    }));
  }, []);

  // Handle constituency selection from map
  const handleConstituencySelect = (constData) => {
    if (constData) {
      const fullData = SCOTTISH_CONSTITUENCIES.find(c => c.code === constData.code);
      setSelectedConstituency(fullData || null);
    } else {
      setSelectedConstituency(null);
    }
  };

  // Filter constituencies by region
  const filteredConstituencies = useMemo(() => {
    let filtered = [...SCOTTISH_CONSTITUENCIES];
    if (selectedRegion !== "All regions") {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }
    return filtered.sort((a, b) => b.avgGain - a.avgGain);
  }, [selectedRegion]);

  // Prepare chart data for regional comparison
  const regionalData = useMemo(() => {
    const regionStats = {};
    SCOTTISH_CONSTITUENCIES.forEach(c => {
      if (!regionStats[c.region]) {
        regionStats[c.region] = { region: c.region, totalGain: 0, count: 0, totalPovertyReduction: 0 };
      }
      regionStats[c.region].totalGain += c.avgGain;
      regionStats[c.region].totalPovertyReduction += c.povertyReduction;
      regionStats[c.region].count += 1;
    });
    return Object.values(regionStats).map(r => ({
      region: r.region.replace("and ", "& "),
      avgGain: Math.round(r.totalGain / r.count),
      povertyReduction: +(r.totalPovertyReduction / r.count).toFixed(1),
    })).sort((a, b) => b.avgGain - a.avgGain);
  }, []);

  // Top and bottom constituencies
  const topConstituencies = [...SCOTTISH_CONSTITUENCIES]
    .sort((a, b) => b.avgGain - a.avgGain)
    .slice(0, 5);
  const bottomConstituencies = [...SCOTTISH_CONSTITUENCIES]
    .sort((a, b) => a.avgGain - b.avgGain)
    .slice(0, 5);

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
                <span className="metric-label">Poverty rate reduction</span>
                <span className="metric-value">{selectedConstituency.povertyReduction}pp</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Households</span>
                <span className="metric-value">{(selectedConstituency.households / 1000).toFixed(0)}k</span>
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
                formatter={(value, name) => {
                  if (name === "avgGain") return [`£${value}`, "Avg. gain"];
                  return [value, name];
                }}
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
            Constituencies with the largest average household gains from the budget.
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
            Constituencies with the smallest average household gains from the budget.
          </p>
          <div className="constituency-list">
            {bottomConstituencies.map((c, i) => (
              <div
                key={c.code}
                className={`constituency-item ${selectedConstituency?.code === c.code ? 'selected' : ''}`}
                onClick={() => handleConstituencySelect({ code: c.code, name: c.name })}
              >
                <span className="rank">{SCOTTISH_CONSTITUENCIES.length - 4 + i}</span>
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
