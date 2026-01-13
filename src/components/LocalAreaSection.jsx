import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ScotlandMap from "./ScotlandMap";
import "./LocalAreaSection.css";

// Fallback data for constituencies
const FALLBACK_CONSTITUENCIES = [
  { code: "S14000026", name: "Glasgow North East", region: "Glasgow", households: 40000, avgGain: 510, povertyReduction: 2.6 },
  { code: "S14000024", name: "Glasgow East", region: "Glasgow", households: 41000, avgGain: 485, povertyReduction: 2.4 },
  { code: "S14000028", name: "Glasgow South West", region: "Glasgow", households: 42000, avgGain: 470, povertyReduction: 2.3 },
  { code: "S14000025", name: "Glasgow North", region: "Glasgow", households: 44000, avgGain: 440, povertyReduction: 2.1 },
  { code: "S14000014", name: "Dundee Central", region: "North East Scotland", households: 38000, avgGain: 430, povertyReduction: 2.0 },
];

const FALLBACK_REGIONS = ["Central Scotland", "Glasgow", "Highlands and Islands", "Lothian", "Mid Scotland and Fife", "North East Scotland", "South Scotland", "West Scotland"];

export default function LocalAreaSection() {
  const [constituencies, setConstituencies] = useState(FALLBACK_CONSTITUENCIES);
  const [regions, setRegions] = useState(FALLBACK_REGIONS);
  const [selectedConstituency, setSelectedConstituency] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("All regions");
  const [loading, setLoading] = useState(true);

  // Load constituency data from JSON
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/data/constituencies.json");
        if (res.ok) {
          const data = await res.json();
          setConstituencies(data.constituencies);
          setRegions(data.regions || FALLBACK_REGIONS);
        }
      } catch (err) {
        console.warn("Using fallback constituency data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Convert constituency data for the map component
  const mapConstituencyData = useMemo(() => {
    return constituencies.map(c => ({
      constituency_code: c.code,
      constituency_name: c.name,
      average_gain: c.avgGain,
      relative_change: (c.avgGain / 350) * 0.8,
      households: c.households,
      povertyReduction: c.povertyReduction,
    }));
  }, [constituencies]);

  // Handle constituency selection from map
  const handleConstituencySelect = (constData) => {
    if (constData) {
      const fullData = constituencies.find(c => c.code === constData.code);
      setSelectedConstituency(fullData || null);
    } else {
      setSelectedConstituency(null);
    }
  };

  // Filter constituencies by region
  const filteredConstituencies = useMemo(() => {
    let filtered = [...constituencies];
    if (selectedRegion !== "All regions") {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }
    return filtered.sort((a, b) => b.avgGain - a.avgGain);
  }, [constituencies, selectedRegion]);

  // Prepare chart data for regional comparison
  const regionalData = useMemo(() => {
    const regionStats = {};
    constituencies.forEach(c => {
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
  }, [constituencies]);

  // Top and bottom constituencies
  const topConstituencies = useMemo(() => {
    return [...constituencies].sort((a, b) => b.avgGain - a.avgGain).slice(0, 5);
  }, [constituencies]);

  const bottomConstituencies = useMemo(() => {
    return [...constituencies].sort((a, b) => a.avgGain - b.avgGain).slice(0, 5);
  }, [constituencies]);

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
                <span className="rank">{constituencies.length - 4 + i}</span>
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
