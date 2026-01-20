import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { CHART_LOGO } from "../utils/chartLogo.jsx";
import { exportMapAsSvg } from "../utils/exportMapAsSvg";
import "./ScotlandMap.css";

// Chart metadata for export
const CHART_TITLE = "Scottish local authority impacts";
// Note: CHART_DESCRIPTION is now generated dynamically using policyName prop

// Format year for display (e.g., 2026 -> "2026-27")
const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;

// Scottish local authority codes start with 'S'
const isScottishLocalAuthority = (code) => code && code.startsWith("S");

// Policy display names for breakdown tooltip
const POLICY_DISPLAY_NAMES = {
  scp_baby_boost: "SCP Premium for under-ones",
  scp_inflation: "SCP inflation adjustment",
  income_tax_basic_uplift: "Basic rate +7.4%",
  income_tax_intermediate_uplift: "Intermediate rate +7.4%",
};

export default function ScotlandMap({
  localAuthorityData = [],
  selectedYear = 2026,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
  selectedLocalAuthority: controlledLocalAuthority = null,
  onLocalAuthoritySelect = null,
  policyName = "SCP Premium for under-ones",
  selectedPolicies = [],
}) {
  const svgRef = useRef(null);
  const [internalSelectedLocalAuthority, setInternalSelectedLocalAuthority] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Use controlled or internal state
  const selectedLocalAuthority = controlledLocalAuthority !== null
    ? controlledLocalAuthority
    : internalSelectedLocalAuthority;

  const setSelectedLocalAuthority = (laData) => {
    if (onLocalAuthoritySelect) {
      if (laData) {
        onLocalAuthoritySelect({
          code: laData.local_authority_code,
          name: laData.local_authority_name,
        });
      } else {
        onLocalAuthoritySelect(null);
      }
    } else {
      setInternalSelectedLocalAuthority(laData);
    }
  };

  // Load GeoJSON data (Scotland local authorities)
  useEffect(() => {
    fetch("/data/scotland_local_authorities_2021.geojson")
      .then((r) => r.json())
      .then((geojson) => {
        setGeoData(geojson);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading GeoJSON:", error);
        setLoading(false);
      });
  }, []);

  // Create data map from local authority data
  const dataMap = useMemo(() => {
    return new Map(
      localAuthorityData.map((d) => [d.local_authority_code, d])
    );
  }, [localAuthorityData]);

  // Calculate dynamic color extent based on min/max values in data
  const colorExtent = useMemo(() => {
    if (!localAuthorityData || localAuthorityData.length === 0) {
      return { min: 0, max: 10, type: 'positive' };
    }
    const values = localAuthorityData.map(d => d.average_gain || 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // Determine the type of scale needed
    let type = 'diverging';
    if (minVal >= 0) {
      type = 'positive'; // All positive: light green to dark green
    } else if (maxVal <= 0) {
      type = 'negative'; // All negative: light red to dark red
    }

    return {
      min: Math.floor(minVal),
      max: Math.ceil(maxVal),
      type
    };
  }, [localAuthorityData]);

  // Highlight and zoom to controlled local authority when it changes
  useEffect(() => {
    if (!controlledLocalAuthority || !geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Reset all paths
    svg
      .selectAll(".local-authority-path")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.3);

    // Highlight selected local authority
    const selectedPath = svg
      .selectAll(".local-authority-path")
      .filter((d) => d.properties.LAD21CD === controlledLocalAuthority.code);

    selectedPath.attr("stroke", "#1D4044").attr("stroke-width", 1.5);

    // Zoom to the selected local authority
    const pathNode = selectedPath.node();
    if (!pathNode) return;

    const bbox = pathNode.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // Find local authority data
    const laData = dataMap.get(controlledLocalAuthority.code) || {
      local_authority_code: controlledLocalAuthority.code,
      local_authority_name: controlledLocalAuthority.name,
      average_gain: 0,
      relative_change: 0,
    };

    // Show tooltip
    setTooltipData(laData);
    setTooltipPosition({ x: centerX, y: centerY });

    // Smooth zoom to local authority
    const scale = Math.min(4, 0.9 / Math.max(bbox.width / 600, bbox.height / 600));
    const translate = [600 / 2 - scale * centerX, 600 / 2 - scale * centerY];

    if (window.scotlandMapZoomBehavior) {
      const { svg: svgZoom, zoom } = window.scotlandMapZoomBehavior;
      svgZoom
        .transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
        );
    }
  }, [controlledLocalAuthority, geoData, dataMap]);

  // Render map
  useEffect(() => {
    if (!svgRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 700;

    const g = svg.append("g");

    // Get bounds of Scottish local authorities
    const bounds = {
      xMin: Infinity,
      xMax: -Infinity,
      yMin: Infinity,
      yMax: -Infinity,
    };

    geoData.features.forEach((feature) => {
      const coords = feature.geometry?.coordinates;
      if (!coords) return;

      const traverse = (c) => {
        if (typeof c[0] === "number") {
          bounds.xMin = Math.min(bounds.xMin, c[0]);
          bounds.xMax = Math.max(bounds.xMax, c[0]);
          bounds.yMin = Math.min(bounds.yMin, c[1]);
          bounds.yMax = Math.max(bounds.yMax, c[1]);
        } else {
          c.forEach(traverse);
        }
      };
      traverse(coords);
    });

    // Create scale to fit into SVG
    const padding = 20;
    const dataWidth = bounds.xMax - bounds.xMin;
    const dataHeight = bounds.yMax - bounds.yMin;
    const scale = Math.min(
      (width - 2 * padding) / dataWidth,
      (height - 2 * padding) / dataHeight,
    );

    // Calculate centering offsets
    const scaledWidth = dataWidth * scale;
    const scaledHeight = dataHeight * scale;
    const offsetX = (width - scaledWidth) / 2;
    const offsetY = (height - scaledHeight) / 2;

    const projection = d3.geoTransform({
      point: function (x, y) {
        this.stream.point(
          (x - bounds.xMin) * scale + offsetX,
          height - ((y - bounds.yMin) * scale + offsetY),
        );
      },
    });

    const path = d3.geoPath().projection(projection);

    // Color scale - uses average_gain (absolute £ values) with dynamic extent based on data
    const getValue = (d) => d.average_gain || 0;

    // Create color scale based on data range type
    let colorScale;
    if (colorExtent.type === 'positive') {
      // All positive: light green to dark green
      colorScale = d3.scaleLinear()
        .domain([colorExtent.min, colorExtent.max])
        .range(["#bbf7d0", "#15803d"]);
    } else if (colorExtent.type === 'negative') {
      // All negative: dark red to light red (more negative = darker)
      colorScale = d3.scaleLinear()
        .domain([colorExtent.min, colorExtent.max])
        .range(["#b91c1c", "#fecaca"]);
    } else {
      // Diverging: red for negative, green for positive
      colorScale = d3.scaleDiverging()
        .domain([colorExtent.min, 0, colorExtent.max])
        .interpolator((t) => {
          if (t < 0.5) {
            const ratio = t * 2;
            return d3.interpolateRgb("#b91c1c", "#f5f5f5")(ratio);
          } else {
            const ratio = (t - 0.5) * 2;
            return d3.interpolateRgb("#f5f5f5", "#15803d")(ratio);
          }
        });
    }

    // Draw local authorities
    const paths = g
      .selectAll("path")
      .data(geoData.features)
      .join("path")
      .attr("d", path)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.3)
      .attr("class", "local-authority-path")
      .style("cursor", "pointer");

    // Animate fill colors
    paths
      .transition()
      .duration(500)
      .attr("fill", (d) => {
        const laData = dataMap.get(d.properties.LAD21CD);
        return laData ? colorScale(getValue(laData)) : "#ddd";
      });

    // Add event handlers
    paths
      .on("click", function (event, d) {
        event.stopPropagation();

        const laCode = d.properties.LAD21CD;
        const laData = dataMap.get(laCode);

        const localAuthorityName = laData?.local_authority_name
          || d.properties.LAD21NM
          || laCode;

        // Update styling
        svg
          .selectAll(".local-authority-path")
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.3);

        d3.select(this).attr("stroke", "#1D4044").attr("stroke-width", 1.5);

        const selectionData = laData || {
          local_authority_code: laCode,
          local_authority_name: localAuthorityName,
        };

        setSelectedLocalAuthority(selectionData);

        // Get centroid for tooltip
        const pathBounds = path.bounds(d);
        const centerX = (pathBounds[0][0] + pathBounds[1][0]) / 2;
        const centerY = (pathBounds[0][1] + pathBounds[1][1]) / 2;

        if (laData) {
          setTooltipData(laData);
          setTooltipPosition({ x: centerX, y: centerY });
        }

        // Zoom to local authority
        const dx = pathBounds[1][0] - pathBounds[0][0];
        const dy = pathBounds[1][1] - pathBounds[0][1];
        const x = centerX;
        const y = centerY;
        const zoomScale = Math.min(4, 0.9 / Math.max(dx / width, dy / height));
        const translate = [width / 2 - zoomScale * x, height / 2 - zoomScale * y];

        svg
          .transition()
          .duration(750)
          .call(
            zoom.transform,
            d3.zoomIdentity
              .translate(translate[0], translate[1])
              .scale(zoomScale),
          );
      })
      .on("mouseover", function () {
        const currentStrokeWidth = d3.select(this).attr("stroke-width");
        if (currentStrokeWidth === "0.3") {
          d3.select(this).attr("stroke", "#666").attr("stroke-width", 0.8);
        }
      })
      .on("mouseout", function () {
        const currentStrokeWidth = d3.select(this).attr("stroke-width");
        if (currentStrokeWidth !== "1.5") {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.3);
        }
      });

    // Zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    window.scotlandMapZoomBehavior = { svg, zoom };

    // Add PolicyEngine logo
    svg
      .append("image")
      .attr("href", CHART_LOGO.href)
      .attr("width", CHART_LOGO.width)
      .attr("height", CHART_LOGO.height)
      .attr("x", width - CHART_LOGO.width - CHART_LOGO.padding)
      .attr("y", height - CHART_LOGO.height - CHART_LOGO.padding);
  }, [geoData, dataMap, onLocalAuthoritySelect, colorExtent]);

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim() || !localAuthorityData.length) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = localAuthorityData
      .filter((d) => d.local_authority_name.toLowerCase().includes(query))
      .slice(0, 5);

    setSearchResults(results);
  }, [searchQuery, localAuthorityData]);

  // Zoom control functions
  const handleZoomIn = () => {
    if (window.scotlandMapZoomBehavior) {
      const { svg, zoom } = window.scotlandMapZoomBehavior;
      svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (window.scotlandMapZoomBehavior) {
      const { svg, zoom } = window.scotlandMapZoomBehavior;
      svg.transition().duration(300).call(zoom.scaleBy, 0.67);
    }
  };

  const handleResetZoom = () => {
    if (window.scotlandMapZoomBehavior) {
      const { svg, zoom } = window.scotlandMapZoomBehavior;
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
    setTooltipData(null);
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .selectAll(".local-authority-path")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3);
    }
  };

  const selectLocalAuthority = (laData) => {
    setSelectedLocalAuthority(laData);
    setSearchQuery("");
    setSearchResults([]);

    if (!geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);

    svg
      .selectAll(".local-authority-path")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.3);

    const selectedPath = svg
      .selectAll(".local-authority-path")
      .filter((d) => d.properties.LAD21CD === laData.local_authority_code);

    selectedPath.attr("stroke", "#1D4044").attr("stroke-width", 1.5);

    const pathNode = selectedPath.node();
    if (!pathNode) return;

    const bbox = pathNode.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    setTooltipData(laData);
    setTooltipPosition({ x: centerX, y: centerY });

    const dx = bbox.width;
    const dy = bbox.height;
    const scale = Math.min(4, 0.9 / Math.max(dx / 600, dy / 700));
    const translate = [600 / 2 - scale * centerX, 700 / 2 - scale * centerY];

    if (window.scotlandMapZoomBehavior) {
      const { svg: svgZoom, zoom } = window.scotlandMapZoomBehavior;
      svgZoom
        .transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
        );
    }
  };

  const handleExportSvg = async () => {
    if (!svgRef.current) return;

    await exportMapAsSvg(svgRef.current, `scotland-map-${selectedYear}`, {
      title: `${CHART_TITLE}, ${formatYearRange(selectedYear)}`,
      description: `This map shows the average annual household gain from the ${policyName} across Scottish local authorities. Green shading indicates larger gains.`,
      logo: CHART_LOGO,
      tooltipData,
    });
  };

  if (loading) {
    return <div className="scotland-map-loading">Loading map...</div>;
  }

  if (!geoData) {
    return null;
  }

  return (
    <div className="scotland-map-wrapper">
      {/* Header section */}
      <div className="map-header">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Local authority impacts, {formatYearRange(selectedYear)}</h3>
            <p className="chart-description">
              This map shows the average annual household gain from the {policyName}
              across Scottish local authorities. Darker green indicates larger gains.
            </p>
          </div>
          <button
            className="export-button"
            onClick={handleExportSvg}
            title="Download as SVG"
            aria-label="Download map as SVG"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search, year toggle, and legend */}
      <div className="map-top-bar">
        <div className="map-search-section">
          <div className="search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search local authority..."
              className="local-authority-search"
            />
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => (
                  <button
                    key={result.local_authority_code}
                    onClick={() => selectLocalAuthority(result)}
                    className="search-result-item"
                  >
                    <div className="result-name">
                      {result.local_authority_name}
                    </div>
                    <div className="result-value">
                      £{result.average_gain?.toFixed(2) || 0} (
                      {(result.relative_change || 0).toFixed(2)}%)
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {onYearChange && (
          <div className="map-year-toggle">
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
        )}

        <div className="map-legend-horizontal">
          <div className="legend-horizontal-content">
            <div
              className="legend-gradient-horizontal"
              style={{
                background: colorExtent.type === 'positive'
                  ? 'linear-gradient(to right, #bbf7d0, #15803d)'
                  : colorExtent.type === 'negative'
                  ? 'linear-gradient(to right, #b91c1c, #fecaca)'
                  : 'linear-gradient(to right, #b91c1c, #f5f5f5, #15803d)'
              }}
            />
            <div className="legend-labels-horizontal">
              <span>£{colorExtent.min}</span>
              {colorExtent.type === 'diverging' && <span className="legend-zero">£0</span>}
              <span>£{colorExtent.max}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="map-content">
        <div className="map-canvas">
          <svg
            ref={svgRef}
            width="600"
            height="700"
            viewBox="0 0 600 700"
            preserveAspectRatio="xMidYMid meet"
            onClick={() => {
              setTooltipData(null);
              if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg
                  .selectAll(".local-authority-path")
                  .attr("stroke", "#fff")
                  .attr("stroke-width", 0.3);
              }
            }}
          />

          {/* Map controls */}
          <div
            className="map-controls-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="zoom-controls">
              <button
                className="zoom-control-btn"
                onClick={handleZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M10 7V13M7 10H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M15 15L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className="zoom-control-btn"
                onClick={handleZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 10H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M15 15L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className="zoom-control-btn"
                onClick={handleResetZoom}
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.8273 3 17.35 4.30367 19 6.34267" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M21 3V8H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <h4>{tooltipData.local_authority_name}</h4>
              <p
                className="tooltip-value"
                style={{
                  color: (tooltipData.average_gain || 0) >= 0 ? "#16a34a" : "#dc2626",
                }}
              >
                {(tooltipData.average_gain || 0) < 0 ? "-" : ""}£
                {Math.abs(tooltipData.average_gain || 0).toLocaleString("en-GB", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#6b7280" }}>/year</span>
              </p>
              <p className="tooltip-label">Average household gain</p>

              {/* Policy breakdown - only show if multiple policies selected */}
              {tooltipData.policyBreakdown &&
                selectedPolicies.length > 1 &&
                Object.keys(tooltipData.policyBreakdown).length > 1 && (
                  <div className="tooltip-breakdown">
                    <p className="tooltip-breakdown-header">By policy:</p>
                    {Object.entries(tooltipData.policyBreakdown)
                      .sort((a, b) => b[1].avgGain - a[1].avgGain)
                      .map(([reformId, data]) => (
                        <div key={reformId} className="tooltip-breakdown-row">
                          <span className="tooltip-breakdown-name">
                            {POLICY_DISPLAY_NAMES[reformId] || reformId}
                          </span>
                          <span
                            className="tooltip-breakdown-value"
                            style={{
                              color: data.avgGain >= 0 ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {data.avgGain < 0 ? "-" : ""}£
                            {Math.abs(data.avgGain).toFixed(2)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

              {tooltipData.povertyReduction !== undefined && (
                <>
                  <p
                    className="tooltip-value-secondary"
                    style={{ color: "#16a34a" }}
                  >
                    -{parseFloat(tooltipData.povertyReduction).toFixed(2)}pp
                  </p>
                  <p className="tooltip-label">Poverty rate reduction</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
