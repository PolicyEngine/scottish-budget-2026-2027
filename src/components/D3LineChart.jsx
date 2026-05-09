'use client';

import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import "./D3LineChart.css";

const formatYearRange = (year) => `${year}–${(year + 1).toString().slice(-2)}`;

export default function D3LineChart({
  data,
  xKey = "year",
  historicalKey = "historical",
  projectionKey = "projection",
  reformKey = "reform",
  yLabel = "Value",
  yFormat = (v) => v.toFixed(0),
  yDomain,
  historicalLabel = "Official (historical)",
  projectionLabel = "Baseline (projection)",
  reformLabel = "With SCP Premium for under-ones",
  height = 320,
  viewMode = "both", // "outturn", "forecast", "both"
  showReform = false,
}) {
  const showHistorical = viewMode === "both" || viewMode === "outturn";
  const showProjection = viewMode === "both" || viewMode === "forecast";
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  // Responsive sizing
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width } = entries[0].contentRect;
        setDimensions({ width: Math.max(300, width), height });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [height]);

  // Draw chart
  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 24, right: 24, bottom: 48, left: 64 };
    const width = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xExtent = d3.extent(data, (d) => d[xKey]);
    const x = d3
      .scaleLinear()
      .domain(xExtent)
      .range([0, width]);

    const allValues = data.flatMap((d) => {
      const vals = [];
      if (showHistorical && d[historicalKey] != null) vals.push(d[historicalKey]);
      if (showProjection && d[projectionKey] != null) vals.push(d[projectionKey]);
      if (showReform && d[reformKey] != null) vals.push(d[reformKey]);
      return vals;
    });
    const yExtent = yDomain || [0, d3.max(allValues) * 1.1];
    const y = d3.scaleLinear().domain(yExtent).range([chartHeight, 0]);

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

    // X axis
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(data.filter((d, i) => i % 2 === 0).map((d) => d[xKey]))
          .tickFormat((d) => formatYearRange(d))
          .tickSize(0)
          .tickPadding(12)
      )
      .call((g) => g.select(".domain").attr("stroke", "#D1D5DB"))
      .selectAll("text")
      .attr("fill", "#6B7280")
      .attr("font-size", "12px")
      .attr("font-family", "var(--pe-font-body)");

    // Y axis
    g.append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat(yFormat)
          .tickSize(0)
          .tickPadding(12)
      )
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#6B7280")
      .attr("font-size", "12px")
      .attr("font-family", "var(--pe-font-body)");

    // Y axis label
    g.append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .attr("fill", "#344054")
      .attr("font-size", "13px")
      .attr("font-weight", "500")
      .attr("font-family", "var(--pe-font-body)")
      .text(yLabel);

    // Line generators
    const lineHistorical = d3
      .line()
      .defined((d) => d[historicalKey] != null)
      .x((d) => x(d[xKey]))
      .y((d) => y(d[historicalKey]))
      .curve(d3.curveMonotoneX);

    const lineProjection = d3
      .line()
      .defined((d) => d[projectionKey] != null)
      .x((d) => x(d[xKey]))
      .y((d) => y(d[projectionKey]))
      .curve(d3.curveMonotoneX);

    const lineReform = d3
      .line()
      .defined((d) => d[reformKey] != null)
      .x((d) => x(d[xKey]))
      .y((d) => y(d[reformKey]))
      .curve(d3.curveMonotoneX);

    // Draw historical line (solid, gray)
    const historicalData = data.filter((d) => d[historicalKey] != null);
    if (showHistorical && historicalData.length > 0) {
      const historicalPath = g
        .append("path")
        .datum(historicalData)
        .attr("class", "line-historical")
        .attr("fill", "none")
        .attr("stroke", "#9CA3AF")
        .attr("stroke-width", 2.5)
        .attr("d", lineHistorical);

      // Animate
      const totalLength = historicalPath.node().getTotalLength();
      historicalPath
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(800)
        .ease(d3.easeQuadOut)
        .attr("stroke-dashoffset", 0);

      // Dots for historical
      g.selectAll(".dot-historical")
        .data(historicalData)
        .enter()
        .append("circle")
        .attr("class", "dot-historical")
        .attr("cx", (d) => x(d[xKey]))
        .attr("cy", (d) => y(d[historicalKey]))
        .attr("r", 0)
        .attr("fill", "#9CA3AF")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .transition()
        .delay((_, i) => 600 + i * 80)
        .duration(300)
        .attr("r", 5);
    }

    // Draw projection line (dashed, teal)
    const projectionData = data.filter((d) => d[projectionKey] != null);
    if (showProjection && projectionData.length > 0) {
      const projectionPath = g
        .append("path")
        .datum(projectionData)
        .attr("class", "line-projection")
        .attr("fill", "none")
        .attr("stroke", "#319795")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "6,4")
        .attr("d", lineProjection);

      // Animate
      const totalLength = projectionPath.node().getTotalLength();
      projectionPath
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .delay(400)
        .duration(1000)
        .ease(d3.easeQuadOut)
        .attr("stroke-dashoffset", 0)
        .on("end", function () {
          d3.select(this).attr("stroke-dasharray", "6,4");
        });

      // Dots for projection
      g.selectAll(".dot-projection")
        .data(projectionData)
        .enter()
        .append("circle")
        .attr("class", "dot-projection")
        .attr("cx", (d) => x(d[xKey]))
        .attr("cy", (d) => y(d[projectionKey]))
        .attr("r", 0)
        .attr("fill", "#319795")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .transition()
        .delay((_, i) => 1200 + i * 80)
        .duration(300)
        .attr("r", 6);
    }

    // Draw reform line (solid, green)
    const reformData = data.filter((d) => d[reformKey] != null);
    if (showReform && reformData.length > 0) {
      const reformPath = g
        .append("path")
        .datum(reformData)
        .attr("class", "line-reform")
        .attr("fill", "none")
        .attr("stroke", "#38A169")
        .attr("stroke-width", 3)
        .attr("d", lineReform);

      // Animate
      const totalLength = reformPath.node().getTotalLength();
      reformPath
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .delay(800)
        .duration(1000)
        .ease(d3.easeQuadOut)
        .attr("stroke-dashoffset", 0);

      // Dots for reform
      g.selectAll(".dot-reform")
        .data(reformData)
        .enter()
        .append("circle")
        .attr("class", "dot-reform")
        .attr("cx", (d) => x(d[xKey]))
        .attr("cy", (d) => y(d[reformKey]))
        .attr("r", 0)
        .attr("fill", "#38A169")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .transition()
        .delay((_, i) => 1600 + i * 80)
        .duration(300)
        .attr("r", 6);
    }

    // Legend
    const legend = g
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(0, ${chartHeight + 36})`);

    let legendOffset = 0;

    // Historical legend
    if (showHistorical) {
      legend
        .append("line")
        .attr("x1", legendOffset)
        .attr("x2", legendOffset + 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#9CA3AF")
        .attr("stroke-width", 2.5);
      legend
        .append("circle")
        .attr("cx", legendOffset + 10)
        .attr("cy", 0)
        .attr("r", 4)
        .attr("fill", "#9CA3AF");
      legend
        .append("text")
        .attr("x", legendOffset + 28)
        .attr("y", 4)
        .attr("fill", "#6B7280")
        .attr("font-size", "12px")
        .attr("font-family", "var(--pe-font-body)")
        .text(historicalLabel);
      legendOffset += 180;
    }

    // Projection legend
    if (showProjection) {
      legend
        .append("line")
        .attr("x1", legendOffset)
        .attr("x2", legendOffset + 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#319795")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "4,3");
      legend
        .append("circle")
        .attr("cx", legendOffset + 10)
        .attr("cy", 0)
        .attr("r", 4)
        .attr("fill", "#319795");
      legend
        .append("text")
        .attr("x", legendOffset + 28)
        .attr("y", 4)
        .attr("fill", "#6B7280")
        .attr("font-size", "12px")
        .attr("font-family", "var(--pe-font-body)")
        .text(projectionLabel);
      legendOffset += 160;
    }

    // Reform legend
    if (showReform && reformData.length > 0) {
      legend
        .append("line")
        .attr("x1", legendOffset)
        .attr("x2", legendOffset + 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#38A169")
        .attr("stroke-width", 3);
      legend
        .append("circle")
        .attr("cx", legendOffset + 10)
        .attr("cy", 0)
        .attr("r", 4)
        .attr("fill", "#38A169");
      legend
        .append("text")
        .attr("x", legendOffset + 28)
        .attr("y", 4)
        .attr("fill", "#6B7280")
        .attr("font-size", "12px")
        .attr("font-family", "var(--pe-font-body)")
        .text(reformLabel);
    }

    // Tooltip
    const tooltip = d3.select(containerRef.current).select(".chart-tooltip");

    // Hover interaction
    const bisect = d3.bisector((d) => d[xKey]).left;

    g.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", chartHeight)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event);
        const x0 = x.invert(mx);
        const i = bisect(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i];
        if (!d0 || !d1) return;
        const d = x0 - d0[xKey] > d1[xKey] - x0 ? d1 : d0;

        const historical = d[historicalKey];
        const projection = d[projectionKey];
        const reform = d[reformKey];

        let html = `<div class="tooltip-year">${formatYearRange(d[xKey])}</div>`;
        if (showHistorical && historical != null) {
          html += `<div class="tooltip-row"><span class="tooltip-dot historical"></span><span class="tooltip-label">Official:</span><span class="tooltip-value">${yFormat(historical)}</span></div>`;
        }
        if (showProjection && projection != null) {
          html += `<div class="tooltip-row"><span class="tooltip-dot projection"></span><span class="tooltip-label">Baseline:</span><span class="tooltip-value">${yFormat(projection)}</span></div>`;
        }
        if (showReform && reform != null) {
          html += `<div class="tooltip-row"><span class="tooltip-dot reform"></span><span class="tooltip-label">With reform:</span><span class="tooltip-value">${yFormat(reform)}</span></div>`;
        }

        tooltip.html(html).style("opacity", 1).style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 12}px`);
      })
      .on("mouseout", function () {
        tooltip.style("opacity", 0);
      });
  }, [data, dimensions, xKey, historicalKey, projectionKey, reformKey, yLabel, yFormat, yDomain, historicalLabel, projectionLabel, reformLabel, viewMode, showHistorical, showProjection, showReform]);

  return (
    <div ref={containerRef} className="d3-chart-container">
      <svg ref={svgRef}></svg>
      <div className="chart-tooltip"></div>
    </div>
  );
}