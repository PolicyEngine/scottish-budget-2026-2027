import { useState, useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";
import { REFORMS, API_BASE_URL } from "../utils/reformConfig";
import "./HouseholdCalculator.css";

// Default input values
const DEFAULT_INPUTS = {
  employment_income: 30000,
  is_married: false,
  partner_income: 0,
  children_ages: [],
};

// Chart colors matching REFORMS
const CHART_COLORS = {
  total: "#319795",
  scp_baby_boost: "#2C6496",
  income_tax_uplift: "#29AB87",
};

// Slider configurations
const SLIDER_CONFIGS = [
  {
    id: "employment_income",
    label: "Your annual employment income",
    min: 0,
    max: 150000,
    step: 1000,
    format: (v) => `£${d3.format(",.0f")(v)}`,
  },
];

function HouseholdCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [childAgeInput, setChildAgeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [impacts, setImpacts] = useState({
    scp_baby_boost: 0,
    income_tax_uplift: 0,
    total: 0,
  });
  const [variationData, setVariationData] = useState([]);
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);

  // Handle input change
  const handleInputChange = useCallback((id, value) => {
    setInputs((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  // Add child
  const addChild = useCallback(() => {
    const age = parseInt(childAgeInput);
    if (!isNaN(age) && age >= 0 && age <= 18) {
      setInputs((prev) => ({
        ...prev,
        children_ages: [...prev.children_ages, age].sort((a, b) => a - b),
      }));
      setChildAgeInput("");
    }
  }, [childAgeInput]);

  // Remove child
  const removeChild = useCallback((index) => {
    setInputs((prev) => ({
      ...prev,
      children_ages: prev.children_ages.filter((_, i) => i !== index),
    }));
  }, []);

  // Combined calculate function for both single calc and variation
  const calculateAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Run both calculations in parallel
      const [calcResponse, variationResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
        }),
        fetch(`${API_BASE_URL}/calculate-variation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_married: inputs.is_married,
            partner_income: inputs.partner_income,
            children_ages: inputs.children_ages,
          }),
        }),
      ]);

      // Process single calculation
      if (calcResponse.ok) {
        const calcResult = await calcResponse.json();
        if (!calcResult.error) {
          setImpacts({
            scp_baby_boost: calcResult.impacts.scp_baby_boost ?? 0,
            income_tax_uplift: calcResult.impacts.income_tax_uplift ?? 0,
            total: calcResult.total ?? 0,
          });
        } else {
          setError(calcResult.error);
        }
      }

      // Process variation data
      if (variationResponse.ok) {
        const variationResult = await variationResponse.json();
        if (variationResult.data) {
          setVariationData(variationResult.data);
        }
      }
    } catch (err) {
      console.error("Error calculating:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [inputs]);

  // Draw the earnings variation chart
  useEffect(() => {
    if (!variationData.length || !chartRef.current || !chartContainerRef.current) return;

    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove();

    const containerWidth = chartContainerRef.current.clientWidth;
    const margin = { top: 20, right: 24, bottom: 50, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    svg.attr("width", containerWidth).attr("height", 280);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleLinear()
      .domain([0, 150000])
      .range([0, width]);

    const allValues = variationData.flatMap((d) => [
      d.total,
      d.scp_baby_boost,
      d.income_tax_uplift,
    ]);
    const yMax = Math.max(100, d3.max(allValues) * 1.1);
    const yMin = Math.min(0, d3.min(allValues) * 1.1);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(y.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#E2E8F0")
      .attr("stroke-dasharray", "2,2");

    // Zero line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues([0, 25000, 50000, 75000, 100000, 125000, 150000])
          .tickFormat((d) => `£${d / 1000}k`)
          .tickSize(0)
          .tickPadding(10)
      )
      .call((g) => g.select(".domain").attr("stroke", "#D1D5DB"))
      .selectAll("text")
      .attr("fill", "#6B7280")
      .attr("font-size", "11px");

    // X axis label
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#475569")
      .attr("font-size", "12px")
      .text("Employment income");

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `£${d}`)
          .tickSize(0)
          .tickPadding(10)
      )
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#6B7280")
      .attr("font-size", "11px");

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .attr("fill", "#475569")
      .attr("font-size", "12px")
      .text("Annual impact (£)");

    // Line generators
    const lineTotal = d3
      .line()
      .x((d) => x(d.earnings))
      .y((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    const lineScp = d3
      .line()
      .x((d) => x(d.earnings))
      .y((d) => y(d.scp_baby_boost))
      .curve(d3.curveMonotoneX);

    const lineTax = d3
      .line()
      .x((d) => x(d.earnings))
      .y((d) => y(d.income_tax_uplift))
      .curve(d3.curveMonotoneX);

    // Draw lines
    g.append("path")
      .datum(variationData)
      .attr("fill", "none")
      .attr("stroke", CHART_COLORS.income_tax_uplift)
      .attr("stroke-width", 2)
      .attr("d", lineTax);

    g.append("path")
      .datum(variationData)
      .attr("fill", "none")
      .attr("stroke", CHART_COLORS.scp_baby_boost)
      .attr("stroke-width", 2)
      .attr("d", lineScp);

    g.append("path")
      .datum(variationData)
      .attr("fill", "none")
      .attr("stroke", CHART_COLORS.total)
      .attr("stroke-width", 2.5)
      .attr("d", lineTotal);

    // Current income marker
    const currentIncome = inputs.employment_income;
    const currentPoint = variationData.find((d) => d.earnings === currentIncome) ||
      variationData.reduce((prev, curr) =>
        Math.abs(curr.earnings - currentIncome) < Math.abs(prev.earnings - currentIncome) ? curr : prev
      );

    if (currentPoint) {
      // Vertical line at current income
      g.append("line")
        .attr("x1", x(currentIncome))
        .attr("x2", x(currentIncome))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#319795")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.6);

      // Dot at current total
      g.append("circle")
        .attr("cx", x(currentIncome))
        .attr("cy", y(currentPoint.total))
        .attr("r", 6)
        .attr("fill", CHART_COLORS.total)
        .attr("stroke", "white")
        .attr("stroke-width", 2);
    }

    // Legend
    const legend = g.append("g").attr("transform", `translate(${width - 200}, 0)`);

    const legendItems = [
      { label: "Total", color: CHART_COLORS.total },
      { label: "Income tax", color: CHART_COLORS.income_tax_uplift },
      { label: "SCP Premium", color: CHART_COLORS.scp_baby_boost },
    ];

    legendItems.forEach((item, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
      row
        .append("line")
        .attr("x1", 0)
        .attr("x2", 16)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", item.color)
        .attr("stroke-width", 2);
      row
        .append("text")
        .attr("x", 22)
        .attr("y", 4)
        .attr("fill", "#475569")
        .attr("font-size", "11px")
        .text(item.label);
    });

    // Hover interaction
    const hoverLine = g.append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")
      .attr("y1", 0)
      .attr("y2", height)
      .style("opacity", 0);

    const hoverCircleTotal = g.append("circle")
      .attr("r", 5)
      .attr("fill", CHART_COLORS.total)
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("opacity", 0);

    const hoverCircleTax = g.append("circle")
      .attr("r", 4)
      .attr("fill", CHART_COLORS.income_tax_uplift)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const hoverCircleScp = g.append("circle")
      .attr("r", 4)
      .attr("fill", CHART_COLORS.scp_baby_boost)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    // Ensure container has relative positioning for tooltip
    d3.select(chartContainerRef.current).style("position", "relative");

    // Tooltip
    const tooltip = d3.select(chartContainerRef.current)
      .append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "8px")
      .style("padding", "10px 12px")
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 10)
      .style("transition", "opacity 0.15s ease");

    // Overlay for mouse events
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mousemove", function(event) {
        const [mouseX] = d3.pointer(event);
        const earnings = x.invert(mouseX);

        // Find closest data point
        const closest = variationData.reduce((prev, curr) =>
          Math.abs(curr.earnings - earnings) < Math.abs(prev.earnings - earnings) ? curr : prev
        );

        // Update hover elements
        hoverLine
          .attr("x1", x(closest.earnings))
          .attr("x2", x(closest.earnings))
          .style("opacity", 1);

        hoverCircleTotal
          .attr("cx", x(closest.earnings))
          .attr("cy", y(closest.total))
          .style("opacity", 1);

        hoverCircleTax
          .attr("cx", x(closest.earnings))
          .attr("cy", y(closest.income_tax_uplift))
          .style("opacity", 1);

        hoverCircleScp
          .attr("cx", x(closest.earnings))
          .attr("cy", y(closest.scp_baby_boost))
          .style("opacity", 1);

        // Update tooltip
        const sign = (v) => v >= 0 ? "+" : "";
        const tooltipX = x(closest.earnings) + margin.left;
        const tooltipY = Math.min(y(closest.total), y(closest.income_tax_uplift), y(closest.scp_baby_boost));

        tooltip
          .html(`
            <div style="font-weight:600;margin-bottom:6px;color:#1e293b">
              £${closest.earnings.toLocaleString()} income
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="width:10px;height:10px;background:${CHART_COLORS.total};border-radius:2px"></span>
              <span style="color:#475569">Total:</span>
              <span style="font-weight:600;color:${closest.total >= 0 ? '#16a34a' : '#dc2626'}">${sign(closest.total)}£${Math.abs(closest.total).toFixed(0)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="width:10px;height:10px;background:${CHART_COLORS.income_tax_uplift};border-radius:2px"></span>
              <span style="color:#475569">Income tax:</span>
              <span style="font-weight:600;color:${closest.income_tax_uplift >= 0 ? '#16a34a' : '#dc2626'}">${sign(closest.income_tax_uplift)}£${Math.abs(closest.income_tax_uplift).toFixed(0)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:10px;height:10px;background:${CHART_COLORS.scp_baby_boost};border-radius:2px"></span>
              <span style="color:#475569">SCP Premium:</span>
              <span style="font-weight:600;color:${closest.scp_baby_boost >= 0 ? '#16a34a' : '#dc2626'}">${sign(closest.scp_baby_boost)}£${Math.abs(closest.scp_baby_boost).toFixed(0)}</span>
            </div>
          `)
          .style("opacity", 1);

        // Position tooltip - flip if too close to right edge
        if (tooltipX > width - 100) {
          tooltip.style("left", `${tooltipX - 175}px`).style("top", `${tooltipY}px`);
        } else {
          tooltip.style("left", `${tooltipX + 15}px`).style("top", `${tooltipY}px`);
        }
      })
      .on("mouseleave", function() {
        hoverLine.style("opacity", 0);
        hoverCircleTotal.style("opacity", 0);
        hoverCircleTax.style("opacity", 0);
        hoverCircleScp.style("opacity", 0);
        tooltip.style("opacity", 0);
      });

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [variationData, inputs.employment_income]);

  // Format currency
  const formatCurrency = useCallback((value, showSign = true) => {
    const sign = showSign && value >= 0 ? "+" : "";
    return `${sign}£${Math.abs(value).toLocaleString("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }, []);

  const childrenCount = inputs.children_ages.length;
  const babiesCount = inputs.children_ages.filter((age) => age < 1).length;

  return (
    <div className="household-calculator">
      <div className="calculator-header">
        <h3>Calculate your household impact</h3>
        <p className="calculator-subtitle">
          Enter your household details to see how the Scottish Budget 2026-27 affects you
        </p>
      </div>

      <div className="calculator-layout">
        {/* Inputs */}
        <div className="calculator-inputs">
          <h4>Household details</h4>

          {/* Employment income slider */}
          {SLIDER_CONFIGS.map((config) => (
            <div className="input-group" key={config.id}>
              <label>{config.label}</label>
              <div className="slider-row">
                <input
                  type="range"
                  value={inputs[config.id]}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  onChange={(e) => handleInputChange(config.id, parseFloat(e.target.value))}
                />
                <span className="slider-value">{config.format(inputs[config.id])}</span>
              </div>
            </div>
          ))}

          {/* Married checkbox */}
          <div className="input-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={inputs.is_married}
                onChange={(e) => handleInputChange("is_married", e.target.checked)}
              />
              Married or cohabiting
            </label>
          </div>

          {/* Partner income */}
          {inputs.is_married && (
            <div className="input-group">
              <label>Partner's annual employment income</label>
              <div className="slider-row">
                <input
                  type="range"
                  value={inputs.partner_income}
                  min={0}
                  max={150000}
                  step={1000}
                  onChange={(e) => handleInputChange("partner_income", parseFloat(e.target.value))}
                />
                <span className="slider-value">£{d3.format(",.0f")(inputs.partner_income)}</span>
              </div>
            </div>
          )}

          {/* Children */}
          <div className="input-group">
            <label>Children (add ages)</label>
            <div className="children-input-row">
              <input
                type="number"
                value={childAgeInput}
                onChange={(e) => setChildAgeInput(e.target.value)}
                placeholder="Age"
                min="0"
                max="18"
                className="age-input"
              />
              <button type="button" onClick={addChild} className="add-btn">
                Add
              </button>
            </div>
            {childrenCount > 0 && (
              <div className="children-tags">
                {inputs.children_ages.map((age, index) => (
                  <span key={index} className={`child-tag ${age < 1 ? "baby" : ""}`}>
                    {age < 1 ? "Baby" : `${age}yr`}
                    <button type="button" onClick={() => removeChild(index)} className="remove-btn">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <span className="help-text">
              {babiesCount > 0
                ? `${babiesCount} baby/babies under 1 eligible for SCP Premium`
                : "Add a baby (age 0) to see SCP Premium impact"}
            </span>
          </div>

          {/* Calculate button */}
          <button
            type="button"
            onClick={calculateAll}
            className="calculate-btn"
            disabled={loading}
          >
            {loading ? "Calculating..." : "Calculate"}
          </button>
        </div>

        {/* Results */}
        <div className="calculator-results">
          {/* Loading/Error state */}
          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Calculating...</span>
            </div>
          )}

          {error && (
            <div className="error-message">
              Error: {error}. Please try again.
            </div>
          )}

          {/* Total impact card - hide while loading */}
          {!loading && (
            <div
              className={`total-impact-card ${impacts.total > 0 ? "positive" : impacts.total < 0 ? "negative" : "neutral"}`}
            >
              <div className="total-label">Your estimated annual gain</div>
              <div className="total-value">{formatCurrency(impacts.total)}</div>
              <div className="total-context">
                {impacts.total > 0
                  ? "per year from Scottish Budget 2026-27"
                  : "No impact from these policies"}
              </div>
            </div>
          )}

          {/* Breakdown by reform - hide while loading */}
          {!loading && (
            <div className="impact-breakdown">
              <h4>Breakdown by policy</h4>
              {REFORMS.map((reform) => {
                const value = impacts[reform.id] ?? 0;
                return (
                  <div key={reform.id} className="reform-row">
                    <div className="reform-info">
                      <div className="reform-color" style={{ backgroundColor: reform.color }} />
                      <div className="reform-details">
                        <span className="reform-label">{reform.name}</span>
                        <span className="reform-description">{reform.description}</span>
                      </div>
                    </div>
                    <div
                      className={`reform-value ${value > 0 ? "positive" : value < 0 ? "negative" : ""}`}
                    >
                      {formatCurrency(value)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Earnings variation chart - hide while loading */}
          {!loading && (
            <div className="earnings-chart-section">
              <h4>Impact by earnings level</h4>
              <p className="chart-subtitle">
                How the reforms affect households at different income levels
              </p>
              <div ref={chartContainerRef} className="earnings-chart-container">
                {variationData.length > 0 ? (
                <svg ref={chartRef}></svg>
              ) : (
                <div className="chart-placeholder">
                  <span className="chart-hint">
                    Click Calculate to see how impacts vary across the income range
                  </span>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reforms explanation */}
      <div className="reforms-explanation">
        <h4>About the reforms</h4>
        <p>
          <strong>SCP Premium for under-ones:</strong> The Scottish Child Payment increases to £40/week for
          babies under 1 (up from £27.15/week), for families receiving Universal Credit or other
          qualifying benefits.
        </p>
        <p>
          <strong>Income Tax Threshold Uplift:</strong> The basic rate threshold rises from £14,877
          to £16,537, and the intermediate rate threshold from £26,562 to £29,527 (7.4% increases).
        </p>
      </div>
    </div>
  );
}

export default HouseholdCalculator;
