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
  const [variationData, setVariationData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
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

  // Combined calculate function for all years and variation
  const calculateAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate for all years
      const yearPromises = years.map((year) =>
        fetch(`${API_BASE_URL}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...inputs, year }),
        }).then((res) => res.json())
      );

      // Also get variation data for chart
      const variationPromise = fetch(`${API_BASE_URL}/calculate-variation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_married: inputs.is_married,
          partner_income: inputs.partner_income,
          children_ages: inputs.children_ages,
          receives_uc: inputs.receives_uc,
          year: selectedYear,
        }),
      }).then((res) => res.json());

      const [yearResults, variationResult] = await Promise.all([
        Promise.all(yearPromises),
        variationPromise,
      ]);

      // Process yearly data - API now returns all 7 reforms individually
      const processedYearlyData = years.map((year, i) => {
        const result = yearResults[i];
        if (result.error) return { year, total: 0 };

        return {
          year,
          income_tax_basic_uplift: result.impacts?.income_tax_basic_uplift ?? 0,
          income_tax_intermediate_uplift: result.impacts?.income_tax_intermediate_uplift ?? 0,
          higher_rate_freeze: result.impacts?.higher_rate_freeze ?? 0,
          advanced_rate_freeze: result.impacts?.advanced_rate_freeze ?? 0,
          top_rate_freeze: result.impacts?.top_rate_freeze ?? 0,
          scp_inflation: result.impacts?.scp_inflation ?? 0,
          scp_baby_boost: result.impacts?.scp_baby_boost ?? 0,
          total: result.total ?? 0,
        };
      });
      setYearlyData(processedYearlyData);

      // Set current year impacts
      const currentYearData = processedYearlyData.find(
        (d) => d.year === selectedYear
      );
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

      // Process variation data
      if (variationResult.data) {
        setVariationData(variationResult.data);
      }
    } catch (err) {
      console.error("Error calculating:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [inputs, selectedYear, years]);

  // Update impacts and re-fetch variation data when year changes
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

      // Re-fetch variation data for the new year
      fetch(`${API_BASE_URL}/calculate-variation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_married: inputs.is_married,
          partner_income: inputs.partner_income,
          children_ages: inputs.children_ages,
          receives_uc: inputs.receives_uc,
          year: selectedYear,
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.data) {
            setVariationData(result.data);
          }
        })
        .catch((err) => console.error("Error fetching variation data:", err));
    }
  }, [selectedYear, yearlyData, inputs]);

  // Draw the earnings variation chart
  useEffect(() => {
    if (!variationData.length || !chartRef.current || !chartContainerRef.current)
      return;

    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove();

    const containerWidth = chartContainerRef.current.clientWidth;
    const margin = { top: 20, right: 24, bottom: 50, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    svg.attr("width", containerWidth).attr("height", 280);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear().domain([0, 150000]).range([0, width]);

    const allValues = variationData.flatMap((d) => [
      d.total,
      d.scp_baby_boost || 0,
      d.income_tax_uplift || 0,
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
      .text(`Annual impact (£${showRealTerms ? ", 2026 prices" : ""})`);

    // Line generators - only draw total line (cleaner without legend)
    const lineTotal = d3
      .line()
      .x((d) => x(d.earnings))
      .y((d) => y(toRealTerms(d.total, selectedYear)))
      .curve(d3.curveMonotoneX);

    // Draw total line only
    g.append("path")
      .datum(variationData)
      .attr("fill", "none")
      .attr("stroke", CHART_COLORS.total)
      .attr("stroke-width", 2.5)
      .attr("d", lineTotal);

    // Current income marker
    const currentIncome = inputs.employment_income;
    const currentPoint =
      variationData.find((d) => d.earnings === currentIncome) ||
      variationData.reduce((prev, curr) =>
        Math.abs(curr.earnings - currentIncome) <
        Math.abs(prev.earnings - currentIncome)
          ? curr
          : prev
      );

    if (currentPoint) {
      // Vertical line at current income
      g.append("line")
        .attr("x1", x(currentIncome))
        .attr("x2", x(currentIncome))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", CHART_COLORS.total)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.6);

      // Dot at current total
      g.append("circle")
        .attr("cx", x(currentIncome))
        .attr("cy", y(toRealTerms(currentPoint.total, selectedYear)))
        .attr("r", 6)
        .attr("fill", CHART_COLORS.total)
        .attr("stroke", "white")
        .attr("stroke-width", 2);
    }

    // Hover interaction - tooltip (no legend box)
    d3.select(chartContainerRef.current).style("position", "relative");

    const tooltip = d3
      .select(chartContainerRef.current)
      .append("div")
      .attr("class", "chart-tooltip")
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
      .style("min-width", "200px")
      .style("white-space", "nowrap");

    const hoverLine = g
      .append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")
      .attr("y1", 0)
      .attr("y2", height)
      .style("opacity", 0);

    const hoverCircle = g
      .append("circle")
      .attr("r", 5)
      .attr("fill", CHART_COLORS.total)
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("opacity", 0);

    const formatVal = (v) => {
      const sign = v < 0 ? "-" : "+";
      return `${sign}£${Math.abs(v).toFixed(0)}`;
    };

    // Overlay for mouse events
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event);
        const earnings = x.invert(mouseX);

        const closest = variationData.reduce((prev, curr) =>
          Math.abs(curr.earnings - earnings) < Math.abs(prev.earnings - earnings)
            ? curr
            : prev
        );

        hoverLine
          .attr("x1", x(closest.earnings))
          .attr("x2", x(closest.earnings))
          .style("opacity", 1);

        hoverCircle
          .attr("cx", x(closest.earnings))
          .attr("cy", y(toRealTerms(closest.total, selectedYear)))
          .style("opacity", 1);

        const total = toRealTerms(closest.total, selectedYear);
        const basic = toRealTerms(closest.income_tax_basic_uplift || 0, selectedYear);
        const intermediate = toRealTerms(closest.income_tax_intermediate_uplift || 0, selectedYear);
        const higher = toRealTerms(closest.higher_rate_freeze || 0, selectedYear);
        const advanced = toRealTerms(closest.advanced_rate_freeze || 0, selectedYear);
        const top = toRealTerms(closest.top_rate_freeze || 0, selectedYear);
        const scpInf = toRealTerms(closest.scp_inflation || 0, selectedYear);
        const scpBaby = toRealTerms(closest.scp_baby_boost || 0, selectedYear);

        tooltip
          .html(
            `<div style="font-weight:600;margin-bottom:8px;color:#1e293b;font-size:12px">£${closest.earnings.toLocaleString()} income</div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:#0D9488">Basic rate uplift</span><span style="font-weight:500;text-align:right">${formatVal(basic)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:#14B8A6">Intermediate uplift</span><span style="font-weight:500;text-align:right">${formatVal(intermediate)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:#F97316">Higher freeze</span><span style="font-weight:500;text-align:right">${formatVal(higher)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:#FB923C">Advanced freeze</span><span style="font-weight:500;text-align:right">${formatVal(advanced)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:#FDBA74">Top rate freeze</span><span style="font-weight:500;text-align:right">${formatVal(top)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span style="color:#2DD4BF">SCP inflation</span><span style="font-weight:500;text-align:right">${formatVal(scpInf)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:6px"><span style="color:#5EEAD4">SCP baby boost</span><span style="font-weight:500;text-align:right">${formatVal(scpBaby)}</span></div>
<div style="display:flex;justify-content:space-between;gap:16px;padding-top:6px;border-top:1px solid #e2e8f0"><span style="font-weight:600;color:#0F766E">Total</span><span style="font-weight:600;color:${total >= 0 ? "#16a34a" : "#dc2626"}">${formatVal(total)}</span></div>`
          )
          .style("opacity", 1);

        const tooltipX = x(closest.earnings) + margin.left;
        const tooltipY = y(toRealTerms(closest.total, selectedYear));

        if (tooltipX > width - 150) {
          tooltip.style("left", `${tooltipX - 215}px`).style("top", `${tooltipY}px`);
        } else {
          tooltip.style("left", `${tooltipX + 15}px`).style("top", `${tooltipY}px`);
        }
      })
      .on("mouseleave", function () {
        hoverLine.style("opacity", 0);
        hoverCircle.style("opacity", 0);
        tooltip.style("opacity", 0);
      });

    return () => {
      tooltip.remove();
    };
  }, [variationData, inputs.employment_income, selectedYear, showRealTerms, toRealTerms]);

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

          {/* Earnings variation chart */}
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
                      Click Calculate to see how impacts vary across the income
                      range
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default HouseholdCalculator;
