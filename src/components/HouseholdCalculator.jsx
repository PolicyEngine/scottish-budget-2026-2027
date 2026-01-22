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

// Chart colors matching budget impact chart
// Teal = costs to government (good for households)
// Amber = revenue raisers (bad for households)
const CHART_COLORS = {
  total: "#0F766E", // Teal 700
  income_tax_basic_uplift: "#0D9488", // Teal 600
  income_tax_intermediate_uplift: "#0F766E", // Teal 700
  scp_inflation: "#14B8A6", // Teal 500
  scp_baby_boost: "#2DD4BF", // Teal 400
  higher_rate_freeze: "#78350F", // Amber 900 (darkest)
  advanced_rate_freeze: "#92400E", // Amber 800
  top_rate_freeze: "#B45309", // Amber 700
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
  const [selectedYear, setSelectedYear] = useState(2026);
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
  const [byIncomeData, setByIncomeData] = useState([]);
  const yearlyChartRef = useRef(null);
  const yearlyChartContainerRef = useRef(null);
  const incomeChartRef = useRef(null);
  const incomeChartContainerRef = useRef(null);

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

  // State for loading income chart separately
  const [loadingIncomeChart, setLoadingIncomeChart] = useState(false);

  // Calculate function - uses single year endpoint for faster response
  const calculateAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setByIncomeData([]); // Clear previous income data

    try {
      // First, get single year data (faster ~26s instead of ~2min)
      const response = await fetch(`${API_BASE_URL}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, year: selectedYear }),
      });
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Set impacts from single year response
      setImpacts({
        income_tax_basic_uplift: result.impacts.income_tax_basic_uplift,
        income_tax_intermediate_uplift: result.impacts.income_tax_intermediate_uplift,
        higher_rate_freeze: result.impacts.higher_rate_freeze,
        advanced_rate_freeze: result.impacts.advanced_rate_freeze,
        top_rate_freeze: result.impacts.top_rate_freeze,
        scp_inflation: result.impacts.scp_inflation,
        scp_baby_boost: result.impacts.scp_baby_boost,
        total: result.total,
      });

      // Create yearly data from single year (for now, just show selected year)
      setYearlyData([{
        year: selectedYear,
        ...result.impacts,
        total: result.total,
      }]);

      setLoading(false);

      // Then fetch by_income data in background
      setLoadingIncomeChart(true);
      const incomeResponse = await fetch(`${API_BASE_URL}/calculate-by-income`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, year: selectedYear }),
      });
      const incomeResult = await incomeResponse.json();

      if (incomeResult.by_income) {
        setByIncomeData(incomeResult.by_income);
      }
    } catch (err) {
      console.error("Error calculating:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingIncomeChart(false);
    }
  }, [inputs, selectedYear]);

  // Track if we've calculated before (to know when to auto-recalculate on year change)
  const hasCalculated = useRef(false);

  // Update hasCalculated when we get results
  useEffect(() => {
    if (yearlyData.length > 0) {
      hasCalculated.current = true;
    }
  }, [yearlyData]);

  // Re-run calculation when year changes (if we've already calculated once)
  useEffect(() => {
    if (hasCalculated.current && !loading) {
      calculateAll();
    }
  }, [selectedYear]); // Only trigger on year change, not on calculateAll change

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

    // Dynamic Y scale based on stacked values (sum positives and negatives separately)
    const policyKeysForScale = ['income_tax_basic_uplift', 'income_tax_intermediate_uplift', 'higher_rate_freeze', 'advanced_rate_freeze', 'top_rate_freeze', 'scp_inflation', 'scp_baby_boost'];
    let dataMax = 0;
    let dataMin = 0;
    processedData.forEach((d) => {
      let posSum = 0;
      let negSum = 0;
      policyKeysForScale.forEach((key) => {
        const val = d[key] || 0;
        if (val > 0) posSum += val;
        else negSum += val;
      });
      dataMax = Math.max(dataMax, posSum);
      dataMin = Math.min(dataMin, negSum);
    });
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

    // Stacked bars - draw each policy component
    const zeroY = y(0);
    const policyKeys = [
      { key: 'income_tax_basic_uplift', color: CHART_COLORS.income_tax_basic_uplift },
      { key: 'income_tax_intermediate_uplift', color: CHART_COLORS.income_tax_intermediate_uplift },
      { key: 'higher_rate_freeze', color: CHART_COLORS.higher_rate_freeze },
      { key: 'advanced_rate_freeze', color: CHART_COLORS.advanced_rate_freeze },
      { key: 'top_rate_freeze', color: CHART_COLORS.top_rate_freeze },
      { key: 'scp_inflation', color: CHART_COLORS.scp_inflation },
      { key: 'scp_baby_boost', color: CHART_COLORS.scp_baby_boost },
    ];

    processedData.forEach((d) => {
      let posOffset = 0; // Tracks cumulative positive stack position
      let negOffset = 0; // Tracks cumulative negative stack position

      policyKeys.forEach(({ key, color }) => {
        const value = d[key] || 0;
        if (Math.abs(value) < 0.01) return; // Skip zero values

        if (value >= 0) {
          // Positive values stack upward from zero
          const barHeight = zeroY - y(value);
          g.append("rect")
            .attr("x", x(d.year))
            .attr("y", zeroY - posOffset - barHeight)
            .attr("width", x.bandwidth())
            .attr("height", barHeight)
            .attr("fill", color);
          posOffset += barHeight;
        } else {
          // Negative values stack downward from zero
          const barHeight = y(value) - zeroY;
          g.append("rect")
            .attr("x", x(d.year))
            .attr("y", zeroY + negOffset)
            .attr("width", x.bandwidth())
            .attr("height", barHeight)
            .attr("fill", color);
          negOffset += barHeight;
        }
      });

      // Calculate total bar bounds for highlight
      const totalPosHeight = posOffset;
      const totalNegHeight = negOffset;
      const barTop = zeroY - totalPosHeight;
      const barBottom = zeroY + totalNegHeight;
      const totalBarHeight = barBottom - barTop;

      // Highlight selected year
      if (d.year === selectedYear && totalBarHeight > 0) {
        g.append("rect")
          .attr("x", x(d.year) - 2)
          .attr("y", barTop - 2)
          .attr("width", x.bandwidth() + 4)
          .attr("height", totalBarHeight + 4)
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
              <span style="color:#0F766E">Intermediate uplift</span>
              <span style="font-weight:500">${formatVal(d.income_tax_intermediate_uplift)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#78350F">Higher freeze</span>
              <span style="font-weight:500">${formatVal(d.higher_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#92400E">Advanced freeze</span>
              <span style="font-weight:500">${formatVal(d.advanced_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#B45309">Top rate freeze</span>
              <span style="font-weight:500">${formatVal(d.top_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#14B8A6">SCP inflation</span>
              <span style="font-weight:500">${formatVal(d.scp_inflation)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:#2DD4BF">SCP baby boost</span>
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

  // Draw income level chart
  useEffect(() => {
    if (
      !byIncomeData.length ||
      !incomeChartRef.current ||
      !incomeChartContainerRef.current
    )
      return;

    const svg = d3.select(incomeChartRef.current);
    svg.selectAll("*").remove();

    const containerWidth = incomeChartContainerRef.current.clientWidth;
    const margin = { top: 20, right: 24, bottom: 50, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = 220 - margin.top - margin.bottom;

    svg.attr("width", containerWidth).attr("height", 220);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleLinear()
      .domain([0, 200000])
      .range([0, width]);

    const yMin = d3.min(byIncomeData, (d) => d.total);
    const yMax = d3.max(byIncomeData, (d) => d.total);
    const yPadding = Math.max(Math.abs(yMin), Math.abs(yMax)) * 0.1;
    const y = d3
      .scaleLinear()
      .domain([Math.min(yMin - yPadding, 0), Math.max(yMax + yPadding, 0)])
      .range([height, 0])
      .nice();

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
          .ticks(5)
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
      .attr("fill", "#6B7280")
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

    // Area fill
    const area = d3
      .area()
      .x((d) => x(d.income))
      .y0(y(0))
      .y1((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    // Split data into positive and negative areas
    const positiveData = byIncomeData.map((d) => ({
      income: d.income,
      total: Math.max(0, d.total),
    }));
    const negativeData = byIncomeData.map((d) => ({
      income: d.income,
      total: Math.min(0, d.total),
    }));

    // Positive area (teal)
    g.append("path")
      .datum(positiveData)
      .attr("fill", "rgba(13, 148, 136, 0.2)")
      .attr("d", area);

    // Negative area (amber)
    g.append("path")
      .datum(negativeData)
      .attr("fill", "rgba(180, 83, 9, 0.2)")
      .attr("d", area);

    // Line
    const line = d3
      .line()
      .x((d) => x(d.income))
      .y((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(byIncomeData)
      .attr("fill", "none")
      .attr("stroke", CHART_COLORS.total)
      .attr("stroke-width", 2)
      .attr("d", line);


    // Vertical hover line
    const hoverLine = g.append("line")
      .attr("class", "hover-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")
      .style("opacity", 0)
      .style("pointer-events", "none");

    // Tooltip
    d3.select(incomeChartContainerRef.current).style("position", "relative");
    const tooltip = d3
      .select(incomeChartContainerRef.current)
      .append("div")
      .attr("class", "income-chart-tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "8px")
      .style("padding", "10px")
      .style("font-size", "11px")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 10);

    // Hover area
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mousemove", (event) => {
        const [mouseX] = d3.pointer(event);
        const income = x.invert(mouseX);
        const closest = byIncomeData.reduce((prev, curr) =>
          Math.abs(curr.income - income) < Math.abs(prev.income - income) ? curr : prev
        );

        // Update vertical line position
        hoverLine
          .attr("x1", x(closest.income))
          .attr("x2", x(closest.income))
          .style("opacity", 1);

        const formatVal = (v) => {
          if (Math.abs(v) < 0.01) return "£0";
          const sign = v < 0 ? "-" : "+";
          return `${sign}£${Math.abs(v).toFixed(0)}`;
        };

        tooltip
          .html(`
            <div style="font-weight:600;margin-bottom:8px;color:#1e293b;font-size:12px">
              £${closest.income.toLocaleString()} income
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#0D9488">Basic rate uplift</span>
              <span style="font-weight:500">${formatVal(closest.income_tax_basic_uplift)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#0F766E">Intermediate uplift</span>
              <span style="font-weight:500">${formatVal(closest.income_tax_intermediate_uplift)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#78350F">Higher freeze</span>
              <span style="font-weight:500">${formatVal(closest.higher_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#92400E">Advanced freeze</span>
              <span style="font-weight:500">${formatVal(closest.advanced_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#B45309">Top rate freeze</span>
              <span style="font-weight:500">${formatVal(closest.top_rate_freeze)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#14B8A6">SCP inflation</span>
              <span style="font-weight:500">${formatVal(closest.scp_inflation)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:#2DD4BF">SCP baby boost</span>
              <span style="font-weight:500">${formatVal(closest.scp_baby_boost)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #e2e8f0">
              <span style="font-weight:600;color:#0F766E">Total</span>
              <span style="font-weight:600;color:${closest.total >= 0 ? '#16a34a' : '#dc2626'}">${formatVal(closest.total)}</span>
            </div>
          `)
          .style("opacity", 1)
          .style("left", `${x(closest.income) + margin.left - 200}px`)
          .style("top", `${margin.top + 10}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        hoverLine.style("opacity", 0);
      });

    return () => {
      tooltip.remove();
    };
  }, [byIncomeData, inputs.employment_income]);

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

          {/* Year selector dropdown */}
          <div className="input-group">
            <label>Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="year-select"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}-{(year + 1).toString().slice(-2)}
                </option>
              ))}
            </select>
          </div>

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
          {/* Real terms toggle */}
          <div className="results-controls">
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

          {/* Prompt to calculate - shown when no calculation has been done */}
          {!loading && yearlyData.length === 0 && (
            <div className="total-impact-card neutral">
              <div className="total-label" style={{ fontSize: "1rem", color: "white" }}>
                Enter household details and click Calculate to see the impacts
              </div>
            </div>
          )}

          {/* Total impact card - shown after calculation */}
          {!loading && yearlyData.length > 0 && (
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

          {/* Breakdown by reform - only shown after calculation */}
          {!loading && yearlyData.length > 0 && (
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

          {/* Impact by income level chart */}
          {!loading && (loadingIncomeChart || byIncomeData.length > 0) && (
            <div className="yearly-chart-section">
              <h4>Impact by income level</h4>
              <p className="chart-subtitle">
                How the budget affects households at different income levels in {selectedYear}-{(selectedYear + 1).toString().slice(-2)}
              </p>
              {loadingIncomeChart && byIncomeData.length === 0 ? (
                <div className="loading-indicator" style={{ minHeight: "220px" }}>
                  <div className="spinner"></div>
                  <span>Loading income chart...</span>
                </div>
              ) : (
                <div
                  ref={incomeChartContainerRef}
                  className="yearly-chart-container"
                  style={{ minHeight: "220px" }}
                >
                  <svg ref={incomeChartRef}></svg>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

export default HouseholdCalculator;
