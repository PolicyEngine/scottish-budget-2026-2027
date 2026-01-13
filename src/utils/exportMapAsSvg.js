/**
 * Export D3 maps as SVG files with title, description, legend, and tooltip.
 */

import {
  createSvgElement,
  createSvgText,
  createSvgRect,
  createSvgGroup,
  createSvgTspan,
  addSvgNamespaces,
  serializeSvg,
  DEFAULT_FONT,
} from "./svgHelpers";
import { downloadSvg } from "./downloadFile";

/**
 * Convert an image URL to a base64 data URL.
 *
 * @param {string} url - URL or path to the image
 * @returns {Promise<string>} - Base64 data URL
 */
async function imageToBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Style constants
const STYLES = {
  padding: 20,
  titleFontSize: 18,
  descriptionFontSize: 13,
  lineHeight: 1.5,
  titleDescGap: 8,
  legendGradientWidth: 200,
  legendGradientHeight: 12,
  legendLabelFontSize: 12,
  tooltipWidth: 180,
  tooltipHeight: 110,
  tooltipPadding: 12,
  tooltipRadius: 8,
  colors: {
    title: "#374151",
    description: "#4b5563",
    legendText: "#374151",
    background: "white",
    tooltipBorder: "#e5e7eb",
    tooltipLabel: "#6b7280",
    positive: "#16a34a",
    negative: "#dc2626",
    gradientLoss: "#D97706",
    gradientNeutral: "#E5E7EB",
    gradientGain: "#14B8A6",
  },
};

/**
 * Wrap text to fit within a maximum character width.
 *
 * @param {string} text - Text to wrap
 * @param {number} maxCharsPerLine - Maximum characters per line
 * @returns {string[]} - Array of lines
 */
function wrapTextSimple(text, maxCharsPerLine = 100) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + " " + word).length > maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Calculate header height based on title and description.
 *
 * @param {string} title - Chart title
 * @param {string} description - Chart description
 * @returns {number} - Header height in pixels
 */
function calculateHeaderHeight(title, description) {
  const {
    padding,
    titleFontSize,
    descriptionFontSize,
    lineHeight,
    titleDescGap,
  } = STYLES;

  let height = padding; // Top padding

  if (title) {
    height += titleFontSize + titleDescGap;
  }

  if (description) {
    const lines = wrapTextSimple(description);
    height += lines.length * descriptionFontSize * lineHeight;
  }

  height += padding; // Bottom padding before content

  return height;
}

/**
 * Create the title element.
 *
 * @param {string} title - Title text
 * @param {number} y - Y position
 * @returns {SVGTextElement}
 */
function createTitle(title, y) {
  return createSvgText(title, {
    x: STYLES.padding,
    y,
    fontSize: STYLES.titleFontSize,
    fontWeight: "600",
    fill: STYLES.colors.title,
  });
}

/**
 * Create the description element with word wrapping.
 *
 * @param {string} description - Description text
 * @param {number} y - Y position
 * @returns {SVGTextElement}
 */
function createDescription(description, y) {
  const { padding, descriptionFontSize, lineHeight, colors } = STYLES;

  const textElement = createSvgElement("text", { x: padding, y });
  textElement.setAttribute(
    "style",
    `font-family: ${DEFAULT_FONT}; font-size: ${descriptionFontSize}px; font-weight: 400; fill: ${colors.description};`,
  );

  const lines = wrapTextSimple(description);

  lines.forEach((line, index) => {
    const tspan = createSvgTspan(line, {
      x: padding,
      dy: index === 0 ? "0" : `${descriptionFontSize * lineHeight}px`,
    });
    textElement.appendChild(tspan);
  });

  return textElement;
}

/**
 * Create a gradient legend for the map.
 *
 * @param {SVGElement} svg - The SVG element to add the legend to
 * @param {number} centerX - Center X position for the legend
 * @param {number} y - Y position
 * @returns {string} - The gradient ID for reference
 */
function createGradientLegend(svg, centerX, y) {
  const {
    legendGradientWidth,
    legendGradientHeight,
    legendLabelFontSize,
    colors,
  } = STYLES;
  const legendX = centerX - legendGradientWidth / 2;

  // Create gradient definition
  const defs = createSvgElement("defs");
  const gradient = createSvgElement("linearGradient", {
    id: "exportLegendGradient",
    x1: "0%",
    x2: "100%",
  });

  const stops = [
    { offset: "0%", color: colors.gradientLoss },
    { offset: "50%", color: colors.gradientNeutral },
    { offset: "100%", color: colors.gradientGain },
  ];

  stops.forEach(({ offset, color }) => {
    const stop = createSvgElement("stop", { offset, "stop-color": color });
    gradient.appendChild(stop);
  });

  defs.appendChild(gradient);
  svg.appendChild(defs);

  // Add gradient rect
  const gradientRect = createSvgElement("rect", {
    x: legendX,
    y,
    width: legendGradientWidth,
    height: legendGradientHeight,
    fill: "url(#exportLegendGradient)",
    rx: "2",
  });
  svg.appendChild(gradientRect);

  // Add legend labels
  const labelY = y + legendGradientHeight + 15;
  const labelStyle = `font-family: ${DEFAULT_FONT}; font-size: ${legendLabelFontSize}px; font-weight: 500; fill: ${colors.legendText};`;

  const labels = [
    { text: "Loss", x: legendX, anchor: "start" },
    { text: "0%", x: legendX + legendGradientWidth / 2, anchor: "middle" },
    { text: "Gain", x: legendX + legendGradientWidth, anchor: "end" },
  ];

  labels.forEach(({ text, x, anchor }) => {
    const label = createSvgElement("text", { x, y: labelY });
    label.setAttribute("style", labelStyle + ` text-anchor: ${anchor};`);
    label.textContent = text;
    svg.appendChild(label);
  });

  return "exportLegendGradient";
}

/**
 * Create a tooltip/info card for the selected constituency.
 *
 * @param {SVGElement} svg - The SVG element to add the tooltip to
 * @param {Object} data - Tooltip data
 * @param {string} data.constituency_name - Constituency name
 * @param {number} data.average_gain - Average gain in pounds
 * @param {number} data.relative_change - Relative change as percentage
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function createTooltipCard(svg, data, x, y) {
  const { tooltipWidth, tooltipHeight, tooltipPadding, tooltipRadius, colors } =
    STYLES;

  // Background with border
  const bg = createSvgElement("rect", {
    x,
    y,
    width: tooltipWidth,
    height: tooltipHeight,
    fill: colors.background,
    stroke: colors.tooltipBorder,
    "stroke-width": "1",
    rx: tooltipRadius,
  });
  svg.appendChild(bg);

  // Constituency name (truncated if needed)
  const name =
    data.constituency_name.length > 22
      ? data.constituency_name.substring(0, 20) + "..."
      : data.constituency_name;

  const nameText = createSvgText(name, {
    x: x + tooltipPadding,
    y: y + tooltipPadding + 14,
    fontSize: 14,
    fontWeight: "600",
    fill: colors.title,
  });
  svg.appendChild(nameText);

  // Average gain value
  const gainColor = data.average_gain >= 0 ? colors.positive : colors.negative;
  const absGain = Math.abs(data.average_gain).toLocaleString("en-GB", {
    maximumFractionDigits: 0,
  });
  const gainValue = `${data.average_gain < 0 ? "-" : ""}£${absGain}`;

  const gainText = createSvgText(gainValue, {
    x: x + tooltipPadding,
    y: y + tooltipPadding + 38,
    fontSize: 18,
    fontWeight: "700",
    fill: gainColor,
  });
  svg.appendChild(gainText);

  // Label for average gain
  const gainLabel = createSvgText("Average household impact", {
    x: x + tooltipPadding,
    y: y + tooltipPadding + 52,
    fontSize: 11,
    fontWeight: "400",
    fill: colors.tooltipLabel,
  });
  svg.appendChild(gainLabel);

  // Relative change value
  const relColor =
    data.relative_change >= 0 ? colors.positive : colors.negative;
  const relValue = `${data.relative_change >= 0 ? "+" : ""}${data.relative_change.toFixed(2)}%`;

  const relText = createSvgText(relValue, {
    x: x + tooltipPadding,
    y: y + tooltipPadding + 72,
    fontSize: 14,
    fontWeight: "600",
    fill: relColor,
  });
  svg.appendChild(relText);

  // Label for relative change
  const relLabel = createSvgText("Relative change", {
    x: x + tooltipPadding,
    y: y + tooltipPadding + 86,
    fontSize: 11,
    fontWeight: "400",
    fill: colors.tooltipLabel,
  });
  svg.appendChild(relLabel);
}

/**
 * Export a D3 map as an SVG file.
 *
 * @param {SVGSVGElement} svgElement - The SVG element containing the map
 * @param {string} filename - The filename for the downloaded SVG (without extension)
 * @param {Object} options - Export options
 * @param {string} options.title - Title to display above the map
 * @param {string} options.description - Description text below the title
 * @param {Object} options.logo - Logo configuration
 * @param {string} options.logo.href - URL/path to logo image
 * @param {number} options.logo.width - Logo width
 * @param {number} options.logo.height - Logo height
 * @param {Object} options.tooltipData - Selected constituency data for tooltip
 * @returns {Promise<boolean>} - True if export was successful
 */
export async function exportMapAsSvg(
  svgElement,
  filename = "map",
  options = {},
) {
  const { title, description, logo, tooltipData } = options;

  if (!svgElement) {
    console.error("exportMapAsSvg: No SVG element provided");
    return false;
  }

  // Clone the SVG
  const clonedSvg = svgElement.cloneNode(true);

  // Reset zoom transform for clean export
  const gElement = clonedSvg.querySelector("g");
  if (gElement) {
    gElement.removeAttribute("transform");
  }

  // Remove existing image elements with relative URLs (won't work in standalone SVG)
  const existingImages = clonedSvg.querySelectorAll("image");
  existingImages.forEach((img) => {
    const href =
      img.getAttribute("href") ||
      img.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (href && !href.startsWith("data:")) {
      img.remove();
    }
  });

  // Get dimensions
  const width = 800;
  const height = 600;

  // Calculate layout
  const headerHeight = calculateHeaderHeight(title, description);
  const legendHeight = 50;
  const totalHeight = headerHeight + height + legendHeight;

  // Update SVG dimensions
  clonedSvg.setAttribute("width", width);
  clonedSvg.setAttribute("height", totalHeight);
  clonedSvg.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);
  addSvgNamespaces(clonedSvg);

  // Wrap existing content and translate down
  const existingContent = Array.from(clonedSvg.childNodes);
  const contentGroup = createSvgGroup({
    transform: `translate(0, ${headerHeight})`,
  });
  existingContent.forEach((child) => contentGroup.appendChild(child));
  clonedSvg.appendChild(contentGroup);

  // Add white background
  const background = createSvgRect({
    x: 0,
    y: 0,
    width,
    height: totalHeight,
    fill: STYLES.colors.background,
  });
  clonedSvg.insertBefore(background, contentGroup);

  // Add title
  let currentY = STYLES.padding;
  if (title) {
    const titleElement = createTitle(title, currentY + STYLES.titleFontSize);
    clonedSvg.insertBefore(titleElement, contentGroup);
    currentY += STYLES.titleFontSize + STYLES.titleDescGap;
  }

  // Add description
  if (description) {
    const descElement = createDescription(
      description,
      currentY + STYLES.descriptionFontSize,
    );
    clonedSvg.insertBefore(descElement, contentGroup);
  }

  // Add legend gradient at the bottom
  const legendY = headerHeight + height + 15;
  createGradientLegend(clonedSvg, width / 2, legendY);

  // Embed logo on the right of the legend area
  if (logo?.href) {
    try {
      const base64Logo = await imageToBase64(logo.href);
      const logoImage = createSvgElement("image", {
        width: logo.width,
        height: logo.height,
        x: width - logo.width - 10,
        y: legendY + (STYLES.legendGradientHeight - logo.height) / 2 + 5,
      });
      // Set both href and xlink:href for maximum browser compatibility
      logoImage.setAttribute("href", base64Logo);
      logoImage.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "xlink:href",
        base64Logo,
      );
      clonedSvg.appendChild(logoImage);
    } catch (error) {
      console.warn("exportMapAsSvg: Failed to embed logo", error);
    }
  }

  // Add tooltip/hovercard if constituency is selected
  if (tooltipData) {
    const tooltipX = width - STYLES.tooltipWidth - 20;
    const tooltipY = headerHeight + 20;
    createTooltipCard(clonedSvg, tooltipData, tooltipX, tooltipY);
  }

  // Serialize and download
  const svgString = serializeSvg(clonedSvg);
  downloadSvg(svgString, filename);

  return true;
}

export default exportMapAsSvg;
