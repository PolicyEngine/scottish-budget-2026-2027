import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { CHART_LOGO } from "../utils/chartLogo.jsx";
import "./MansionTaxMap.css";

/**
 * Interactive D3 map showing Scottish Mansion Tax impact by Parliament Constituency.
 * Shows estimated revenue share from council tax reform for £1m+ properties.
 */
export default function MansionTaxMap() {
  const svgRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [geoRes, impactRes] = await Promise.all([
          fetch("/data/scottish_parliament_constituencies.geojson"),
          fetch("/data/mansion_tax_constituency_impact.csv"),
        ]);

        if (geoRes.ok) {
          const geo = await geoRes.json();
          setGeoData(geo);
        }

        if (impactRes.ok) {
          const csvText = await impactRes.text();
          const lines = csvText.trim().split("\n");
          const headers = lines[0].split(",");
          const data = {};

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",");
            const row = {};
            headers.forEach((h, idx) => {
              row[h.trim()] = values[idx]?.trim();
            });
            data[row.constituency] = {
              name: row.constituency,
              pct: parseFloat(row.share_pct) || 0,
              num: parseInt(row.estimated_sales) || 0,
              rev: parseInt(row.allocated_revenue) || 0,
              council: row.council || "Unknown",
            };
          }

          setImpactData(data);
        }
      } catch (err) {
        console.error("Error loading mansion tax data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute color scale extent
  const colorExtent = useMemo(() => {
    if (!impactData) return { min: 0, max: 12 };
    const values = Object.values(impactData).map(d => d.pct);
    return {
      min: 0,
      max: Math.ceil(Math.max(...values) * 10) / 10,
    };
  }, [impactData]);

  // Render D3 map
  useEffect(() => {
    if (!geoData || !impactData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 700;
    const height = 900;
    const g = svg.append("g");

    // Calculate bounds
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    geoData.features.forEach(feature => {
      const traverse = (coords) => {
        if (typeof coords[0] === "number") {
          xMin = Math.min(xMin, coords[0]);
          xMax = Math.max(xMax, coords[0]);
          yMin = Math.min(yMin, coords[1]);
          yMax = Math.max(yMax, coords[1]);
        } else {
          coords.forEach(traverse);
        }
      };
      traverse(feature.geometry.coordinates);
    });

    // Scale to fit
    const padding = 20;
    const dataWidth = xMax - xMin;
    const dataHeight = yMax - yMin;
    const geoScale = Math.min((width - 2 * padding) / dataWidth, (height - 2 * padding) / dataHeight) * 0.92;
    const geoOffsetX = (width - dataWidth * geoScale) / 2;
    const geoOffsetY = padding;

    const projection = d3.geoTransform({
      point: function(x, y) {
        this.stream.point(
          (x - xMin) * geoScale + geoOffsetX,
          height - ((y - yMin) * geoScale + geoOffsetY)
        );
      }
    });

    const pathGenerator = d3.geoPath().projection(projection);

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    window.mansionTaxMapZoomBehavior = { svg, zoom, pathGenerator };

    // Color scale (log scale for better variation)
    const minPct = 0.01;
    const maxPct = colorExtent.max;
    const logScale = d3.scaleLog()
      .domain([minPct, maxPct])
      .range([0, 1])
      .clamp(true);

    const colorScale = (pct) => {
      if (pct === 0) return "#77C3BC";
      const t = logScale(Math.max(pct, minPct));
      return d3.interpolate("#77C3BC", "#0D9488")(t);
    };

    // Draw paths
    g.selectAll("path")
      .data(geoData.features)
      .join("path")
      .attr("class", "constituency-path")
      .attr("d", pathGenerator)
      .attr("fill", d => {
        const name = d.properties.SPC21NM;
        const data = impactData[name];
        return data ? colorScale(data.pct) : colorScale(0);
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.3)
      .on("click", function(event, d) {
        event.stopPropagation();
        const name = d.properties.SPC21NM;
        const data = impactData[name] || { name, pct: 0, num: 0, rev: 0, council: "Unknown" };

        // Reset all strokes
        svg.selectAll(".constituency-path")
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.3);

        // Highlight selected
        d3.select(this).attr("stroke", "#1D4044").attr("stroke-width", 1.5);

        // Show tooltip
        const bounds = pathGenerator.bounds(d);
        const centerX = (bounds[0][0] + bounds[1][0]) / 2;
        const centerY = (bounds[0][1] + bounds[1][1]) / 2;
        setTooltipData(data);
        setTooltipPosition({ x: centerX, y: centerY });

        // Zoom to constituency
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const scale = Math.min(4, 0.9 / Math.max(dx / width, dy / height));
        const translate = [width / 2 - scale * centerX, height / 2 - scale * centerY];

        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
      })
      .on("mouseover", function() {
        const currentStrokeWidth = d3.select(this).attr("stroke-width");
        if (currentStrokeWidth === "0.3") {
          d3.select(this).attr("stroke", "#666").attr("stroke-width", 0.8);
        }
      })
      .on("mouseout", function() {
        const currentStrokeWidth = d3.select(this).attr("stroke-width");
        if (currentStrokeWidth !== "1.5") {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.3);
        }
      });

    // Add PolicyEngine logo
    svg
      .append("image")
      .attr("href", CHART_LOGO.href)
      .attr("width", CHART_LOGO.width)
      .attr("height", CHART_LOGO.height)
      .attr("x", width - CHART_LOGO.width - CHART_LOGO.padding)
      .attr("y", height - CHART_LOGO.height - CHART_LOGO.padding);

  }, [geoData, impactData, colorExtent]);

  // Handle search
  useEffect(() => {
    if (!impactData || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = Object.values(impactData)
      .filter(d => d.name.toLowerCase().includes(query))
      .slice(0, 5);

    setSearchResults(results);
  }, [searchQuery, impactData]);

  // Zoom controls
  const handleZoomIn = () => {
    if (window.mansionTaxMapZoomBehavior) {
      const { svg, zoom } = window.mansionTaxMapZoomBehavior;
      svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (window.mansionTaxMapZoomBehavior) {
      const { svg, zoom } = window.mansionTaxMapZoomBehavior;
      svg.transition().duration(300).call(zoom.scaleBy, 0.67);
    }
  };

  const handleResetZoom = () => {
    if (window.mansionTaxMapZoomBehavior) {
      const { svg, zoom } = window.mansionTaxMapZoomBehavior;
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
    setTooltipData(null);
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.selectAll(".constituency-path")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3);
    }
  };

  const selectConstituency = (data) => {
    setSearchQuery("");
    setSearchResults([]);

    if (!geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll(".constituency-path")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.3);

    const selectedPath = svg.selectAll(".constituency-path")
      .filter(d => d.properties.SPC21NM === data.name);

    selectedPath.attr("stroke", "#1D4044").attr("stroke-width", 1.5);

    const pathNode = selectedPath.node();
    if (!pathNode) return;

    const bbox = pathNode.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    setTooltipData(data);
    setTooltipPosition({ x: centerX, y: centerY });

    const scale = Math.min(4, 0.9 / Math.max(bbox.width / 700, bbox.height / 900));
    const translate = [700 / 2 - scale * centerX, 900 / 2 - scale * centerY];

    if (window.mansionTaxMapZoomBehavior) {
      const { svg: svgZoom, zoom } = window.mansionTaxMapZoomBehavior;
      svgZoom.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
    }
  };

  if (loading) {
    return <div className="scotland-map-loading">Loading map...</div>;
  }

  if (!geoData || !impactData) {
    return null;
  }

  return (
    <div className="scotland-map-wrapper mansion-tax-map">
      {/* Header section */}
      <div className="map-header">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Mansion tax impact by constituency</h3>
            <p className="chart-description">
              Number of high-value property sales by Scotland parliamentary constituency
            </p>
          </div>
        </div>
      </div>

      {/* Search and legend */}
      <div className="map-top-bar">
        <div className="map-search-section">
          <div className="search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search constituency..."
              className="local-authority-search"
            />
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => (
                  <button
                    key={result.name}
                    onClick={() => selectConstituency(result)}
                    className="search-result-item"
                  >
                    <div className="result-name">{result.name}</div>
                    <div className="result-value">
                      {result.num} sales | {result.pct.toFixed(2)}%
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="map-legend-horizontal">
          <div className="legend-horizontal-content">
            <div
              className="legend-gradient-horizontal"
              style={{
                background: "linear-gradient(to right, #77C3BC, #0D9488)"
              }}
            />
            <div className="legend-labels-horizontal">
              <span>0%</span>
              <span>{colorExtent.max.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="map-content">
        <div className="map-canvas">
          <svg
            ref={svgRef}
            width="700"
            height="900"
            viewBox="0 0 700 900"
            preserveAspectRatio="xMidYMid meet"
            onClick={() => {
              setTooltipData(null);
              if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg.selectAll(".constituency-path")
                  .attr("stroke", "#fff")
                  .attr("stroke-width", 0.3);
              }
            }}
          />

          {/* Map controls */}
          <div className="map-controls-container" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-controls">
              <button className="zoom-control-btn" onClick={handleZoomIn} title="Zoom in">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M10 7V13M7 10H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M15 15L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="zoom-control-btn" onClick={handleZoomOut} title="Zoom out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 10H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M15 15L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="zoom-control-btn" onClick={handleResetZoom} title="Reset zoom">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tooltip overlay */}
          {tooltipData && (
            <div
              className="local-authority-tooltip"
              style={{
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="tooltip-close"
                onClick={() => setTooltipData(null)}
              >
                ×
              </div>
              <h4>{tooltipData.name}</h4>
              <p className="tooltip-subtitle">{tooltipData.council}</p>
              <p className="tooltip-value" style={{ color: "#0D9488" }}>
                {tooltipData.pct.toFixed(2)}%
              </p>
              <p className="tooltip-label">Share of revenue</p>
              <p className="tooltip-value-secondary" style={{ color: "#374151" }}>
                £{(tooltipData.rev / 1000000).toFixed(2)}m
              </p>
              <p className="tooltip-label">Est. revenue ({tooltipData.num} sales)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
