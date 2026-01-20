#!/usr/bin/env python3
"""
Generate projected income tax threshold values based on CPI uprating.

Uses OBR CPI forecasts from PolicyEngine UK parameters.
"""

# OBR CPI forecasts (from policyengine-uk/parameters/gov/economic_assumptions/yoy_growth.yaml)
CPI_FORECASTS = {
    2027: 0.0202,  # 2.02%
    2028: 0.0204,  # 2.04%
    2029: 0.0204,  # 2.04%
    2030: 0.0200,  # 2.00%
}

# 2026-27 thresholds (from Scottish Budget)
BASIC_RATE_2026 = 16538
INTERMEDIATE_RATE_2026 = 29527


def calculate_projections():
    """Calculate threshold projections based on CPI uprating."""

    # Basic rate threshold
    basic = {2026: BASIC_RATE_2026}
    prev = BASIC_RATE_2026
    for year in [2027, 2028, 2029, 2030]:
        cpi = CPI_FORECASTS[year]
        new_val = round(prev * (1 + cpi))
        basic[year] = new_val
        prev = new_val

    # Intermediate rate threshold
    intermediate = {2026: INTERMEDIATE_RATE_2026}
    prev = INTERMEDIATE_RATE_2026
    for year in [2027, 2028, 2029, 2030]:
        cpi = CPI_FORECASTS[year]
        new_val = round(prev * (1 + cpi))
        intermediate[year] = new_val
        prev = new_val

    return basic, intermediate


def main():
    basic, intermediate = calculate_projections()

    print("=" * 60)
    print("Basic Rate Threshold Projections (CPI uprated)")
    print("=" * 60)
    print(f"{'Year':<12} {'Threshold':<15} {'CPI':<10} {'Change':<10}")
    print("-" * 60)
    prev = 15398  # 2025-26 baseline
    for year in [2026, 2027, 2028, 2029, 2030]:
        threshold = basic[year]
        if year == 2026:
            change = (threshold / prev - 1) * 100
            cpi_str = "+7.4%"
        else:
            cpi = CPI_FORECASTS[year] * 100
            cpi_str = f"+{cpi:.2f}%"
            change = (threshold / prev - 1) * 100
        print(f"{year}-{year+1-2000:<5} £{threshold:,}        {cpi_str:<10} +{change:.1f}%")
        prev = threshold

    print("\n")
    print("=" * 60)
    print("Intermediate Rate Threshold Projections (CPI uprated)")
    print("=" * 60)
    print(f"{'Year':<12} {'Threshold':<15} {'CPI':<10} {'Change':<10}")
    print("-" * 60)
    prev = 27492  # 2025-26 baseline
    for year in [2026, 2027, 2028, 2029, 2030]:
        threshold = intermediate[year]
        if year == 2026:
            change = (threshold / prev - 1) * 100
            cpi_str = "+7.4%"
        else:
            cpi = CPI_FORECASTS[year] * 100
            cpi_str = f"+{cpi:.2f}%"
            change = (threshold / prev - 1) * 100
        print(f"{year}-{year+1-2000:<5} £{threshold:,}        {cpi_str:<10} +{change:.1f}%")
        prev = threshold

    print("\n")
    print("=" * 60)
    print("JSX Table Data (copy-paste ready)")
    print("=" * 60)

    print("\n// Basic rate threshold table rows:")
    print(f'<tr><td style={{tdStyle}}>2025-26</td><td style={{tdRightStyle}}>£15,398</td><td style={{tdCenterStyle}}>—</td></tr>')
    print(f'<tr><td style={{tdStyle}}>2026-27</td><td style={{tdRightStyle}}>£{basic[2026]:,}</td><td style={{{{...tdCenterStyle, color: "#2e7d32"}}}}>+7.4%</td></tr>')
    for year in [2027, 2028, 2029]:
        cpi = CPI_FORECASTS[year] * 100
        print(f'<tr><td style={{tdStyle}}>{year}-{year+1-2000}</td><td style={{tdRightStyle}}>£{basic[year]:,}</td><td style={{{{...tdCenterStyle, color: "#2e7d32"}}}}>+{cpi:.1f}%</td></tr>')
    year = 2030
    cpi = CPI_FORECASTS[year] * 100
    print(f'<tr><td style={{{{...tdStyle, borderBottom: "none"}}}}>{year}-{year+1-2000}</td><td style={{{{...tdRightStyle, borderBottom: "none"}}}}>£{basic[year]:,}</td><td style={{{{...tdCenterStyle, borderBottom: "none", color: "#2e7d32"}}}}>+{cpi:.1f}%</td></tr>')

    print("\n// Intermediate rate threshold table rows:")
    print(f'<tr><td style={{tdStyle}}>2025-26</td><td style={{tdRightStyle}}>£27,492</td><td style={{tdCenterStyle}}>—</td></tr>')
    print(f'<tr><td style={{tdStyle}}>2026-27</td><td style={{tdRightStyle}}>£{intermediate[2026]:,}</td><td style={{{{...tdCenterStyle, color: "#2e7d32"}}}}>+7.4%</td></tr>')
    for year in [2027, 2028, 2029]:
        cpi = CPI_FORECASTS[year] * 100
        print(f'<tr><td style={{tdStyle}}>{year}-{year+1-2000}</td><td style={{tdRightStyle}}>£{intermediate[year]:,}</td><td style={{{{...tdCenterStyle, color: "#2e7d32"}}}}>+{cpi:.1f}%</td></tr>')
    year = 2030
    cpi = CPI_FORECASTS[year] * 100
    print(f'<tr><td style={{{{...tdStyle, borderBottom: "none"}}}}>{year}-{year+1-2000}</td><td style={{{{...tdRightStyle, borderBottom: "none"}}}}>£{intermediate[year]:,}</td><td style={{{{...tdCenterStyle, borderBottom: "none", color: "#2e7d32"}}}}>+{cpi:.1f}%</td></tr>')


if __name__ == "__main__":
    main()
