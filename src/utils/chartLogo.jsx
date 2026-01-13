/**
 * PolicyEngine chart logo component and configuration.
 * Used for embedding the logo in Recharts charts and SVG exports.
 */

// Logo configuration - smaller, consistent size across all charts
export const CHART_LOGO = {
  href: "/assets/logos/policyengine-teal.png",
  width: 80,
  height: 17, // Maintains aspect ratio (996:207 ≈ 4.8:1)
  padding: 8,
};

/**
 * PolicyEngine logo component for embedding in Recharts charts.
 * Use with the Recharts <Customized> component.
 *
 * @example
 * <Customized component={PolicyEngineLogo} />
 */
export function PolicyEngineLogo({ xAxisMap, yAxisMap, height }) {
  const xAxis = xAxisMap && Object.values(xAxisMap)[0];
  const yAxis = yAxisMap && Object.values(yAxisMap)[0];

  if (!xAxis || !yAxis) return null;

  // Position in bottom-right, inline with the legend area
  const x = xAxis.x + xAxis.width - CHART_LOGO.width;
  const y = height - CHART_LOGO.height - CHART_LOGO.padding;

  return (
    <image
      href={CHART_LOGO.href}
      x={x}
      y={y}
      width={CHART_LOGO.width}
      height={CHART_LOGO.height}
    />
  );
}

export default PolicyEngineLogo;
