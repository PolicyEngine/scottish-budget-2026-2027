"""
Visualization module for Scottish Mansion Tax analysis.

Generates:
1. Bar chart of top constituencies by impact
2. Interactive HTML report with all data
3. Council breakdown pie chart
4. Edinburgh constituency breakdown
"""

from pathlib import Path
from typing import Optional

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def create_bar_chart(df: pd.DataFrame, top_n: int = 25) -> go.Figure:
    """Create bar chart of top constituencies.

    Args:
        df: Analysis results DataFrame
        top_n: Number of top constituencies to show

    Returns:
        Plotly Figure object
    """
    # Get top constituencies by impact
    top_df = df.head(top_n).copy()
    top_df = top_df.sort_values("allocated_revenue", ascending=True)

    fig = go.Figure()

    fig.add_trace(
        go.Bar(
            y=top_df["constituency"],
            x=top_df["allocated_revenue"] / 1e6,
            orientation="h",
            marker_color="#2E86AB",
            text=[f"£{v/1e6:.2f}m" for v in top_df["allocated_revenue"]],
            textposition="outside",
            hovertemplate=(
                "<b>%{y}</b><br>"
                "Council: %{customdata[0]}<br>"
                "Est. sales: %{customdata[1]:.1f}<br>"
                "Revenue: £%{x:.2f}m<br>"
                "<extra></extra>"
            ),
            customdata=top_df[["council", "estimated_sales"]].values,
        )
    )

    fig.update_layout(
        title=dict(
            text="Scottish Mansion Tax Impact by Parliament Constituency<br>"
            f"<sub>Top {top_n} constituencies by estimated annual revenue (£1m+ properties)</sub>",
            x=0.5,
            xanchor="center",
            font=dict(size=18),
        ),
        xaxis=dict(
            title="Estimated Annual Revenue (£ millions)",
            tickformat=".1f",
            ticksuffix="m",
            showgrid=True,
            gridcolor="#E0E0E0",
        ),
        yaxis=dict(title="", tickfont=dict(size=10)),
        height=700,
        width=900,
        margin=dict(l=200, r=80, t=100, b=60),
        plot_bgcolor="white",
        paper_bgcolor="white",
    )

    return fig


def create_council_breakdown_chart(df: pd.DataFrame) -> go.Figure:
    """Create pie chart showing council-level breakdown.

    Args:
        df: Analysis results DataFrame

    Returns:
        Plotly Figure object
    """
    # Aggregate by council
    council_df = (
        df.groupby("council")
        .agg(
            {
                "estimated_sales": "sum",
                "allocated_revenue": "sum",
                "share_pct": "sum",
            }
        )
        .reset_index()
    )
    council_df = council_df.sort_values("allocated_revenue", ascending=False)

    # Top councils + "Other"
    top_councils = council_df.head(10)
    other_revenue = (
        council_df.iloc[10:]["allocated_revenue"].sum() if len(council_df) > 10 else 0
    )

    if other_revenue > 0:
        other_row = pd.DataFrame(
            [
                {
                    "council": "Other councils",
                    "allocated_revenue": other_revenue,
                    "estimated_sales": council_df.iloc[10:]["estimated_sales"].sum(),
                }
            ]
        )
        plot_df = pd.concat([top_councils, other_row], ignore_index=True)
    else:
        plot_df = top_councils

    fig = px.pie(
        plot_df,
        values="allocated_revenue",
        names="council",
        title="Mansion Tax Revenue Distribution by Council Area",
        color_discrete_sequence=px.colors.qualitative.Set3,
    )

    fig.update_traces(
        textposition="inside",
        textinfo="percent+label",
        hovertemplate="<b>%{label}</b><br>Revenue: £%{value:,.0f}<br>Share: %{percent}<extra></extra>",
    )

    fig.update_layout(
        height=500,
        width=700,
        title=dict(x=0.5, xanchor="center"),
        legend=dict(orientation="h", y=-0.1),
    )

    return fig


def create_edinburgh_breakdown(df: pd.DataFrame) -> go.Figure:
    """Create detailed Edinburgh constituency breakdown.

    Args:
        df: Analysis results DataFrame

    Returns:
        Plotly Figure object
    """
    edinburgh_df = df[df["council"] == "City of Edinburgh"].copy()
    edinburgh_df = edinburgh_df.sort_values("allocated_revenue", ascending=True)

    fig = go.Figure()

    fig.add_trace(
        go.Bar(
            y=edinburgh_df["constituency"],
            x=edinburgh_df["allocated_revenue"] / 1e6,
            orientation="h",
            marker_color=[
                "#1A535C",
                "#4ECDC4",
                "#FF6B6B",
                "#FFE66D",
                "#95E1D3",
                "#F38181",
            ],
            text=[
                f"£{v/1e6:.2f}m ({s:.0f} sales)"
                for v, s in zip(
                    edinburgh_df["allocated_revenue"], edinburgh_df["estimated_sales"]
                )
            ],
            textposition="outside",
            hovertemplate=(
                "<b>%{y}</b><br>"
                "Est. sales: %{customdata:.1f}<br>"
                "Revenue: £%{x:.2f}m<br>"
                "<extra></extra>"
            ),
            customdata=edinburgh_df["estimated_sales"],
        )
    )

    total_revenue = edinburgh_df["allocated_revenue"].sum()
    total_sales = edinburgh_df["estimated_sales"].sum()

    fig.update_layout(
        title=dict(
            text=f"Edinburgh Constituencies - Mansion Tax Impact<br>"
            f"<sub>Total: £{total_revenue/1e6:.2f}m ({total_sales:.0f} estimated sales)</sub>",
            x=0.5,
            xanchor="center",
        ),
        xaxis=dict(
            title="Estimated Annual Revenue (£ millions)",
            tickformat=".2f",
            ticksuffix="m",
        ),
        yaxis=dict(title=""),
        height=350,
        width=700,
        margin=dict(l=180, r=80, t=80, b=40),
        plot_bgcolor="white",
    )

    return fig


def create_html_report(df: pd.DataFrame) -> str:
    """Create comprehensive HTML report.

    Args:
        df: Analysis results DataFrame

    Returns:
        HTML string
    """
    # Calculate summary stats
    total_revenue = df["allocated_revenue"].sum()
    total_sales = df["estimated_sales"].sum()
    constituencies_with_impact = len(df[df["estimated_sales"] > 0])

    edinburgh_df = df[df["council"] == "City of Edinburgh"]
    edinburgh_revenue = edinburgh_df["allocated_revenue"].sum()
    edinburgh_share = edinburgh_revenue / total_revenue * 100

    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Scottish Mansion Tax - Parliament Constituency Analysis</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #2E86AB 0%, #1A535C 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        h1 {{ margin: 0 0 10px 0; font-size: 28px; }}
        .subtitle {{ opacity: 0.9; font-size: 16px; }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }}
        .stat-value {{ font-size: 32px; font-weight: bold; color: #2E86AB; }}
        .stat-label {{ color: #666; margin-top: 5px; }}
        .section {{
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        h2 {{ color: #1A535C; border-bottom: 2px solid #4ECDC4; padding-bottom: 10px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        th {{ background: #2E86AB; color: white; padding: 12px; text-align: left; }}
        td {{ padding: 10px 12px; border-bottom: 1px solid #e0e0e0; }}
        tr:hover {{ background: #f8f9fa; }}
        .highlight {{ background: #e3f2fd; }}
        .policy-box {{
            background: #f8f9fa;
            border-left: 4px solid #4ECDC4;
            padding: 15px;
            margin: 20px 0;
        }}
        .footer {{ text-align: center; color: #666; padding: 20px; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Scottish Mansion Tax Impact Analysis</h1>
        <div class="subtitle">By Scottish Parliament Constituency (2021 Boundaries)</div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">£{total_revenue/1e6:.1f}m</div>
            <div class="stat-label">Total Estimated Revenue</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{total_sales:.0f}</div>
            <div class="stat-label">Estimated £1m+ Sales/Year</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{constituencies_with_impact}</div>
            <div class="stat-label">Constituencies Affected</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{edinburgh_share:.0f}%</div>
            <div class="stat-label">Edinburgh Share</div>
        </div>
    </div>

    <div class="section">
        <h2>Policy Overview</h2>
        <div class="policy-box">
            <strong>Scottish Budget 2026-27 Council Tax Reform</strong><br><br>
            <ul>
                <li><strong>Effective:</strong> 1 April 2028</li>
                <li><strong>New Band I:</strong> Properties £1m-£2m</li>
                <li><strong>New Band J:</strong> Properties £2m+</li>
                <li><strong>Expected revenue:</strong> £16 million annually</li>
            </ul>
        </div>
    </div>

    <div class="section">
        <h2>Top 20 Constituencies by Impact</h2>
        <table>
            <tr>
                <th>Rank</th>
                <th>Constituency</th>
                <th>Council Area</th>
                <th>Est. Sales</th>
                <th>Revenue</th>
                <th>Share</th>
            </tr>
"""

    for i, (_, row) in enumerate(df.head(20).iterrows(), 1):
        highlight = (
            ' class="highlight"' if row["council"] == "City of Edinburgh" else ""
        )
        html += f"""            <tr{highlight}>
                <td>{i}</td>
                <td><strong>{row['constituency']}</strong></td>
                <td>{row['council']}</td>
                <td>{row['estimated_sales']}</td>
                <td>£{row['allocated_revenue']/1e6:.2f}m</td>
                <td>{row['share_pct']:.1f}%</td>
            </tr>
"""

    html += """        </table>
    </div>

    <div class="section">
        <h2>Methodology</h2>
        <p>This analysis distributes council-level mansion tax estimates to Scottish Parliament
        constituencies using <strong>wealth-adjusted allocation</strong>:</p>
        <ul>
            <li>Council-level £1m+ property sales data from Registers of Scotland (391 sales)</li>
            <li>Constituency-to-council geographic mapping (2021 boundaries)</li>
            <li>Population weights from NRS Scottish Parliamentary Constituency Estimates</li>
            <li><strong>Wealth factors</strong> from Council Tax Band F-H data (statistics.gov.scot)</li>
        </ul>
        <p>Within each council, revenue is allocated using:
        <code>Weight = (Population × Wealth Factor) / Council Total</code></p>
    </div>

    <div class="footer">
        Analysis based on Scottish Government Budget 2026-27 proposals<br>
        Data: Registers of Scotland | Scottish Parliament 2021 boundaries
    </div>
</body>
</html>"""

    return html


def generate_all_visualizations(
    df: pd.DataFrame,
    output_dir: Optional[Path] = None,
    verbose: bool = True,
) -> dict:
    """Generate all visualizations and save to output directory.

    Args:
        df: Analysis results DataFrame
        output_dir: Directory to save outputs. Defaults to ./output/
        verbose: Print progress messages

    Returns:
        Dictionary with paths to generated files
    """
    if output_dir is None:
        output_dir = Path("output")
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    outputs = {}

    if verbose:
        print("Generating visualizations...")

    # Bar chart
    bar_fig = create_bar_chart(df)
    bar_path = output_dir / "mansion_tax_bar_chart.html"
    bar_fig.write_html(str(bar_path))
    outputs["bar_chart"] = bar_path
    if verbose:
        print(f"   ✓ Bar chart: {bar_path}")

    # Try PNG export
    try:
        png_path = output_dir / "mansion_tax_bar_chart.png"
        bar_fig.write_image(str(png_path), width=1000, height=800)
        outputs["bar_chart_png"] = png_path
        if verbose:
            print(f"   ✓ Bar chart PNG: {png_path}")
    except Exception:
        if verbose:
            print("   ⚠️ PNG export skipped (install kaleido for image export)")

    # Council breakdown
    council_fig = create_council_breakdown_chart(df)
    council_path = output_dir / "mansion_tax_council_breakdown.html"
    council_fig.write_html(str(council_path))
    outputs["council_breakdown"] = council_path
    if verbose:
        print(f"   ✓ Council breakdown: {council_path}")

    # Edinburgh breakdown
    edin_fig = create_edinburgh_breakdown(df)
    edin_path = output_dir / "mansion_tax_edinburgh.html"
    edin_fig.write_html(str(edin_path))
    outputs["edinburgh_breakdown"] = edin_path
    if verbose:
        print(f"   ✓ Edinburgh breakdown: {edin_path}")

    # HTML report
    html_report = create_html_report(df)
    report_path = output_dir / "mansion_tax_report.html"
    report_path.write_text(html_report)
    outputs["html_report"] = report_path
    if verbose:
        print(f"   ✓ HTML report: {report_path}")

    return outputs
