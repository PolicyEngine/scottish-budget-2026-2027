import { useState, useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";
import { REFORMS, API_BASE_URL } from "../utils/reformConfig";
import "./HouseholdCalculator.css";

// CPI forecasts for real terms conversion (from OBR)
const CPI_FORECASTS = {
  2026: 0.024,
  2027: 0.021,
  2028: 0.02,
  2029: 0.02,
  2030: 0.02,
};

// Default input values
const DEFAULT_INPUTS = {
  employment_income: 30000,
  is_married: false,
  partner_income: 0,
  children_ages: [],
  receives_uc: true, // UC or other qualifying benefit for SCP
};

// Chart colors matching REFORMS
const CHART_COLORS = {
  total: "#0F766E", // Teal 700
  income_tax_basic_uplift: "#0D9488", // Teal 600
  income_tax_intermediate_uplift: "#14B8A6", // Teal 500
  higher_rate_freeze: "#F97316", // Orange 500
  advanced_rate_freeze: "#FB923C", // Orange 400
  top_rate_freeze: "#FDBA74", // Orange 300
  scp_inflation: "#2DD4BF", // Teal 400
  scp_baby_boost: "#5EEAD4", // Teal 300
};

// Slider configurations
const SLIDER_CONFIGS = [
  {
    id: "employment_income",
    label: "Your annual employment income",
    min: 0,
    max: 200000,
    step: 1000,
    format: (v) => `£${d3.format(",.0f")(v)}`,
    tooltip: "Your gross annual salary before tax",
  },
];

function HouseholdCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [childAgeInput, setChildAgeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(2027);
  const [showRealTerms, setShowRealTerms] = useState(false);
  const [impacts, setImpacts] = useState({
    income_tax_basic_uplift: 0,
    income_tax_intermediate_uplift: 0,
    higher_rate_freeze: 0,
    advanced_rate_freeze: 0,
    top_rate_freeze: 0,
    scp_inflation: 0,
    scp_baby_boost: 0,
    total: 0,
  });
  const [yearlyData, setYearlyData] = useState([]);
  const yearlyChartRef = useRef(null);
  const yearlyChartContainerRef = useRef(null);

  const years = [2026, 2027, 2028, 2029, 2030];

  // Calculate cumulative inflation from 2026 to target year
  const getCumulativeInflation = useCallback((targetYear) => {
    if (targetYear <= 2026) return 1.0;
    let factor = 1.0;
    for (let y = 2026; y < targetYear; y++) {
      const rate = CPI_FORECASTS[y] || 0.02;
      factor *= 1 + rate;
    }
    return factor;
  }, []);

  // Convert nominal value to 2026 real terms
  const toRealTerms = useCallback(
    (value, year) => {
      if (!showRealTerms) return value;
      const inflationFactor = getCumulativeInflation(year);
      return value / inflationFactor;
    },
    [showRealTerms, getCumulativeInflation]
  );

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

  // Combined calculate function - single API request for all data
  const calculateAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/calculate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, year: selectedYear }),
      });
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Process yearly data
      setYearlyData(result.yearly);

      // Set current year impacts
      const currentYearData = result.yearly.find((d) => d.year === selectedYear);
      if (currentYearData) {
        setImpacts({
          income_tax_basic_uplift: currentYearData.income_tax_basic_uplift,
          income_tax_intermediate_uplift: currentYearData.income_tax_intermediate_uplift,
          higher_rate_freeze: currentYearData.higher_rate_freeze,
          advanced_rate_freeze: currentYearData.advanced_rate_freeze,
          top_rate_freeze: currentYearData.top_rate_freeze,
          scp_inflation: currentYearData.scp_inflation,
          scp_baby_boost: currentYearData.scp_baby_boost,
          total: currentYearData.total,
        });
      }
    } catch (err) {
      console.error("Error calculating:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [inputs, selectedYear]);

  // Update impacts when year changes
  useEffect(() => {
    if (yearlyData.length > 0) {
      const currentYearData = yearlyData.find((d) => d.year === selectedYear);
      if (currentYearData) {
        setImpacts({
          income_tax_basic_uplift: currentYearData.income_tax_basic_uplift,
          income_tax_intermediate_uplift: currentYearData.income_tax_intermediate_uplift,
          higher_rate_freeze: currentYearData.higher_rate_freeze,
          advanced_rate_freeze: currentYearData.advanced_rate_freeze,
          top_rate_freeze: currentYearData.top_rate_freeze,
          scp_inflation: currentYearData.scp_inflation,
          scp_baby_boost: currentYearData.scp_baby_boost,
          total: currentYearData.total,
        });
      }
    }
  }, [selectedYear, yearlyData]);

  // Draw yearly projection chart
  useEffect(() => {
    if (
      !yearlyData.length ||
      !yearlyChartRef.current ||
      !yearlyChartContainerRef.current
    )
      return;

    const svg = d3.select(yearlyChartRef.current);
    svg.selectAll("*").remove();

    const containerWidth = yearlyChartContainerRef.current.clientWidth;
    const margin = { top: 20, right: 24, bottom: 40, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    svg.attr("width", containerWidth).attr("height", 200);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Process data for stacked bar - keep raw data for tooltip
    const processedData = yearlyData.map((d) => ({
      year: d.year,
      income_tax: toRealTerms(
        (d.income_tax_basic_uplift || 0) + (d.income_tax_intermediate_uplift || 0),
        d.year
      ),
      scp: toRealTerms((d.scp_inflation || 0) + (d.scp_baby_boost || 0), d.year),
      total: toRealTerms(d.total, d.year),
      // Keep individual reform values for tooltip
      income_tax_basic_uplift: toRealTerms(d.income_tax_basic_uplift || 0, d.year),
      income_tax_intermediate_uplift: toRealTerms(d.income_tax_intermediate_uplift || 0, d.year),
      higher_rate_freeze: toRealTerms(d.higher_rate_freeze || 0, d.year),
      advanced_rate_freeze: toRealTerms(d.advanced_rate_freeze || 0, d.year),
      top_rate_freeze: toRealTerms(d.top_rate_freeze || 0, d.year),
      scp_inflation: toRealTerms(d.scp_inflation || 0, d.year),
      scp_baby_boost: toRealTerms(d.scp_baby_boost || 0, d.year),
    }));

    // Scales
    const x = d3
      .scaleBand()
      .domain(processedData.map((d) => d.year))
      .range([0, width])
      .padding(0.3);

    // Dynamic Y scale based on actual data values (handle both positive and negative)
    const allTotals = processedData.map((d) => d.total);
    const dataMax = Math.max(...allTotals);
    const dataMin = Math.min(...allTotals);
    const yMax = dataMax > 0 ? dataMax * 1.2 : 10;
    const yMin = dataMin < 0 ? dataMin * 1.2 : 0;
    const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]).nice();

    // Light grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(y.ticks(4))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#E2E8F0")
      .attr("stroke-dasharray", "2,2");

    // Zero line (if scale includes negative values)
    if (yMin < 0) {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1);
    }

    // X axis (always at bottom for this chart)
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((d) => `${d}-${(d + 1).toString().slice(-2)}`)
          .tickSize(0)
          .tickPadding(10)
      )
      .call((g) => g.select(".domain").attr("stroke", "#D1D5DB"))
      .selectAll("text")
      .attr("fill", "#6B7280")
      .attr("font-size", "11px");

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((d) => `£${d}`)
          .tickSize(0)
          .tickPadding(10)
      )
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#6B7280")
      .attr("font-size", "11px");

    // Bars - simple total bar (handles positive and negative)
    const zeroY = y(0);
    processedData.forEach((d) => {
      const barY = d.total >= 0 ? y(d.total) : zeroY;
      const barHeight = Math.abs(y(d.total) - zeroY);

      // Draw bar from zero line
      if (barHeight > 0) {
        g.append("rect")
          .attr("class", `bar-${d.year}`)
          .attr("x", x(d.year))
          .attr("y", barY)
          .attr("width", x.bandwidth())
          .attr("height", barHeight)
          .attr("fill", d.total >= 0 ? CHART_COLORS.income_tax_basic_uplift : "#F97316")
          .attr("rx", 2);
      }

      // Highlight selected year
      if (d.year === selectedYear) {
        g.append("rect")
          .attr("x", x(d.year) - 2)
          .attr("y", barY - 2)
          .attr("width", x.bandwidth() + 4)
          .attr("height", barHeight + 4)
          .attr("fill", "none")
          .attr("stroke", CHART_COLORS.total)
          .attr("stroke-width", 2)
          .attr("rx", 4);
      }
    });

    // Total line
    const line = d3
      .line()
      .x((d) => x(d.year) + x.bandwidth() / 2)
      .y((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", CHART_COLORS.total)
      .attr("stroke-width", 2)
      .attr("d", line);

    // Dots on line
    g.selectAll(".total-dot")
      .data(processedData)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.year) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.total))
      .attr("r", 4)
      .attr("fill", CHART_COLORS.total)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);

    // Tooltip
    d3.select(yearlyChartContainerRef.current).style("position", "relative");
    const tooltip = d3
      .select(yearlyChartContainerRef.current)
      .append("div")
      .attr("class", "yearly-chart-tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "8px")
      .style("padding", "12px")
      .style("font-size", "11px")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 10)
      .style("min-width", "180px");

    const formatVal = (v) => {
      const sign = v < 0 ? "-" : "+";
      return `${sign}£${Math.abs(v).toFixed(0)}`;
    };

    // Click and hover handler for year selection
    g.selectAll(".year-clickarea")
      .data(processedData)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.year))
      .attr("y", 0)
      .attr("width", x.bandwidth())
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("click", (event, d) => setSelectedYear(d.year))
      .on("mouseover", (event, d) => {
        tooltip
          .html(`
            <div style="font-weight:600;margin-bottom:8px;color:#1e293b;font-size:12px">
              ${d.year}-${(d.year + 1).toString().slice(-2)}
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#0D9488">Basic rate uplift</span>
              <span style="font-weight:500">${formatVal(d.income_tax_basic_uplift)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#14B8A6">Intermediate uplift</span>
              <span style="font-weight:500">${formatVal(d.income_tax_intermediate_uplift)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#F97316">Higher freeze</span>
              <span style="font-weight:500">${formatVal(d.higher_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#FB923C">Advanced freeze</span>
              <span style="font-weight:500">${formatVal(d.advanced_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#FDBA74">Top rate freeze</span>
              <span style="font-weight:500">${formatVal(d.top_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#2DD4BF">SCP inflation</span>
              <span style="font-weight:500">${formatVal(d.scp_inflation)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:#5EEAD4">SCP baby boost</span>
              <span style="font-weight:500">${formatVal(d.scp_baby_boost)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #e2e8f0">
              <span style="font-weight:600;color:#0F766E">Total</span>
              <span style="font-weight:600;color:${d.total >= 0 ? '#16a34a' : '#dc2626'}">${formatVal(d.total)}</span>
            </div>
          `)
          .style("opacity", 1)
          .style("left", `${x(d.year) + x.bandwidth() / 2 + margin.left - 90}px`)
          .style("top", `${y(d.total) - 10}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    return () => {
      tooltip.remove();
    };
  }, [yearlyData, selectedYear, showRealTerms, toRealTerms]);

  // Format currency
  const formatCurrency = useCallback(
    (value, showSign = true) => {
      const sign = value < 0 ? "-" : (value > 0 && showSign ? "+" : "");
      return `${sign}£${Math.abs(value).toLocaleString("en-GB", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    },
    []
  );

  const childrenCount = inputs.children_ages.length;
  const babiesCount = inputs.children_ages.filter((age) => age < 1).length;
  const scpEligibleChildren = inputs.receives_uc
    ? inputs.children_ages.filter((age) => age < 16).length
    : 0;

  return (
    <div className="household-calculator">
      <div className="calculator-header">
        <h3>Calculate your household impact</h3>
        <p className="calculator-subtitle">
          Enter your household details to see how the Scottish Budget 2026-27
          affects you over time. For descriptions of the policies, see the 2026 Budget tab.
        </p>
      </div>

      <div className="calculator-layout">
        {/* Inputs */}
        <div className="calculator-inputs">
          <h4>Household details</h4>

          {/* Employment income slider */}
          {SLIDER_CONFIGS.map((config) => (
            <div className="input-group" key={config.id}>
              <label>
                {config.label}
                {config.tooltip && (
                  <span className="tooltip-icon" title={config.tooltip}>
                    ?
                  </span>
                )}
              </label>
              <div className="slider-row">
                <input
                  type="range"
                  value={inputs[config.id]}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  onChange={(e) =>
                    handleInputChange(config.id, parseFloat(e.target.value))
                  }
                />
                <span className="slider-value">
                  {config.format(inputs[config.id])}
                </span>
              </div>
            </div>
          ))}

          {/* Married checkbox */}
          <div className="input-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={inputs.is_married}
                onChange={(e) =>
                  handleInputChange("is_married", e.target.checked)
                }
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
                  max={200000}
                  step={1000}
                  onChange={(e) =>
                    handleInputChange("partner_income", parseFloat(e.target.value))
                  }
                />
                <span className="slider-value">
                  £{d3.format(",.0f")(inputs.partner_income)}
                </span>
              </div>
            </div>
          )}

          {/* UC eligibility */}
          <div className="input-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={inputs.receives_uc}
                onChange={(e) =>
                  handleInputChange("receives_uc", e.target.checked)
                }
              />
              Receives Universal Credit
            </label>
            <span className="help-text">
              Required for Scottish Child Payment
            </span>
          </div>

          {/* Children */}
          <div className="input-group">
            <label>Children</label>
            <div className="children-section">
              <div className="children-input-row">
                <input
                  type="number"
                  value={childAgeInput}
                  onChange={(e) => setChildAgeInput(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="18"
                  className="age-input"
                />
                <button type="button" onClick={addChild} className="add-btn">
                  Add child
                </button>
              </div>
              {childrenCount > 0 && (
                <div className="children-tags">
                  {inputs.children_ages.map((age, index) => (
                    <span
                      key={index}
                      className={`child-tag ${age < 1 ? "baby" : ""}`}
                    >
                      {age < 1 ? "Baby (<1)" : `${age} yr`}
                      <button
                        type="button"
                        onClick={() => removeChild(index)}
                        className="remove-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <span className="help-text">
                {inputs.receives_uc && scpEligibleChildren > 0
                  ? `${scpEligibleChildren} eligible for SCP${babiesCount > 0 ? ` · ${babiesCount} for baby premium` : ""}`
                  : "Enter age (0 for babies under 1)"}
              </span>
            </div>
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
          {/* Year selector and real terms toggle */}
          <div className="results-controls">
            <div className="year-selector">
              <label>Year:</label>
              <div className="year-buttons">
                {years.map((year) => (
                  <button
                    key={year}
                    className={`year-btn ${year === selectedYear ? "active" : ""}`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year}-{(year + 1).toString().slice(-2)}
                  </button>
                ))}
              </div>
            </div>
            <div className="real-terms-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={showRealTerms}
                  onChange={(e) => setShowRealTerms(e.target.checked)}
                />
                Show in 2026 prices
              </label>
            </div>
          </div>

          {/* Loading/Error state */}
          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Calculating...</span>
            </div>
          )}

          {error && (
            <div className="error-message">Error: {error}. Please try again.</div>
          )}

          {/* Total impact card */}
          {!loading && (
            <div
              className={`total-impact-card ${impacts.total > 0 ? "positive" : impacts.total < 0 ? "negative" : "neutral"}`}
            >
              <div className="total-label">
                Your estimated annual {impacts.total >= 0 ? "gain" : "cost"} in {selectedYear}-
                {(selectedYear + 1).toString().slice(-2)}
              </div>
              <div className="total-value">
                {formatCurrency(toRealTerms(impacts.total, selectedYear))}
              </div>
              <div className="total-context">
                {impacts.total !== 0
                  ? `per year from Scottish Budget 2026-27${showRealTerms ? " (2026 prices)" : ""}`
                  : "No impact from these policies"}
              </div>
            </div>
          )}

          {/* Breakdown by reform */}
          {!loading && (
            <div className="impact-breakdown">
              <h4>Breakdown by policy</h4>
              {REFORMS.map((reform) => {
                const value = impacts[reform.id] ?? 0;
                const displayValue = toRealTerms(value, selectedYear);
                return (
                  <div key={reform.id} className="reform-row">
                    <div className="reform-info">
                      <div
                        className="reform-color"
                        style={{ backgroundColor: reform.color }}
                      />
                      <span className="reform-label">{reform.name}</span>
                    </div>
                    <div
                      className="reform-value"
                      style={{ color: displayValue > 0 ? "#16a34a" : displayValue < 0 ? "#dc2626" : "#64748b" }}
                    >
                      {formatCurrency(displayValue)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Yearly projection chart */}
          {!loading && yearlyData.length > 0 && (
            <div className="yearly-chart-section">
              <h4>Impact over time</h4>
              <p className="chart-subtitle">
                Click a year to see detailed breakdown
              </p>
              <div
                ref={yearlyChartContainerRef}
                className="yearly-chart-container"
              >
                <svg ref={yearlyChartRef}></svg>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

export default HouseholdCalculator;
