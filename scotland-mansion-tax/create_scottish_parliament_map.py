#!/usr/bin/env python3
"""
Create visualizations of Scottish Mansion Tax impact by Scottish Parliament Constituency.

Generates:
1. Bar chart of top constituencies by impact
2. Interactive HTML report with all data
3. Summary statistics
"""

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from pathlib import Path

# Revenue and policy constants
SCOTTISH_GOV_REVENUE_ESTIMATE = 16_000_000  # £16 million


def load_constituency_data():
    """Load the constituency impact data."""
    print("Loading constituency impact data...")

    input_file = "scottish_parliament_constituency_impact.csv"
    if not Path(input_file).exists():
        print(f"ERROR: {input_file} not found")
        print("Run: python analyze_scottish_parliament_constituencies.py")
        return None

    df = pd.read_csv(input_file)
    print(f"Loaded {len(df)} constituencies")
    return df


def create_bar_chart(df, top_n=25):
    """Create bar chart of top constituencies."""
    print(f"Creating bar chart for top {top_n} constituencies...")

    # Get top constituencies by impact
    top_df = df.head(top_n).copy()
    top_df = top_df.sort_values('allocated_revenue', ascending=True)  # For horizontal bar chart

    # Create figure
    fig = go.Figure()

    fig.add_trace(go.Bar(
        y=top_df['constituency'],
        x=top_df['allocated_revenue'] / 1e6,  # Convert to millions
        orientation='h',
        marker_color='#2E86AB',
        text=[f"£{v/1e6:.2f}m" for v in top_df['allocated_revenue']],
        textposition='outside',
        hovertemplate=(
            "<b>%{y}</b><br>"
            "Council: %{customdata[0]}<br>"
            "Est. sales: %{customdata[1]:.1f}<br>"
            "Revenue: £%{x:.2f}m<br>"
            "<extra></extra>"
        ),
        customdata=top_df[['council', 'estimated_sales']].values
    ))

    fig.update_layout(
        title=dict(
            text='Scottish Mansion Tax Impact by Parliament Constituency<br>'
                 '<sub>Top 25 constituencies by estimated annual revenue (£1m+ properties)</sub>',
            x=0.5,
            xanchor='center',
            font=dict(size=18)
        ),
        xaxis=dict(
            title='Estimated Annual Revenue (£ millions)',
            tickformat='.1f',
            ticksuffix='m',
            showgrid=True,
            gridcolor='#E0E0E0'
        ),
        yaxis=dict(
            title='',
            tickfont=dict(size=10)
        ),
        height=700,
        width=900,
        margin=dict(l=200, r=80, t=100, b=60),
        plot_bgcolor='white',
        paper_bgcolor='white'
    )

    return fig


def create_council_breakdown_chart(df):
    """Create pie/bar chart showing council-level breakdown."""
    print("Creating council breakdown chart...")

    # Aggregate by council
    council_df = df.groupby('council').agg({
        'estimated_sales': 'sum',
        'allocated_revenue': 'sum',
        'share_pct': 'sum'
    }).reset_index()
    council_df = council_df.sort_values('allocated_revenue', ascending=False)

    # Top councils + "Other"
    top_councils = council_df.head(10)
    other_revenue = council_df.iloc[10:]['allocated_revenue'].sum() if len(council_df) > 10 else 0

    if other_revenue > 0:
        other_row = pd.DataFrame([{
            'council': 'Other councils',
            'allocated_revenue': other_revenue,
            'estimated_sales': council_df.iloc[10:]['estimated_sales'].sum()
        }])
        plot_df = pd.concat([top_councils, other_row], ignore_index=True)
    else:
        plot_df = top_councils

    fig = px.pie(
        plot_df,
        values='allocated_revenue',
        names='council',
        title='Mansion Tax Revenue Distribution by Council Area',
        color_discrete_sequence=px.colors.qualitative.Set3
    )

    fig.update_traces(
        textposition='inside',
        textinfo='percent+label',
        hovertemplate="<b>%{label}</b><br>Revenue: £%{value:,.0f}<br>Share: %{percent}<extra></extra>"
    )

    fig.update_layout(
        height=500,
        width=700,
        title=dict(x=0.5, xanchor='center'),
        legend=dict(orientation='h', y=-0.1)
    )

    return fig


def create_edinburgh_breakdown(df):
    """Create detailed Edinburgh constituency breakdown."""
    print("Creating Edinburgh constituency breakdown...")

    edinburgh_df = df[df['council'] == 'City of Edinburgh'].copy()
    edinburgh_df = edinburgh_df.sort_values('allocated_revenue', ascending=True)

    fig = go.Figure()

    fig.add_trace(go.Bar(
        y=edinburgh_df['constituency'],
        x=edinburgh_df['allocated_revenue'] / 1e6,
        orientation='h',
        marker_color=['#1A535C', '#4ECDC4', '#FF6B6B', '#FFE66D', '#95E1D3', '#F38181'],
        text=[f"£{v/1e6:.2f}m ({s:.0f} sales)"
              for v, s in zip(edinburgh_df['allocated_revenue'], edinburgh_df['estimated_sales'])],
        textposition='outside',
        hovertemplate=(
            "<b>%{y}</b><br>"
            "Est. sales: %{customdata:.1f}<br>"
            "Revenue: £%{x:.2f}m<br>"
            "<extra></extra>"
        ),
        customdata=edinburgh_df['estimated_sales']
    ))

    total_revenue = edinburgh_df['allocated_revenue'].sum()
    total_sales = edinburgh_df['estimated_sales'].sum()

    fig.update_layout(
        title=dict(
            text=f'Edinburgh Constituencies - Mansion Tax Impact<br>'
                 f'<sub>Total: £{total_revenue/1e6:.2f}m ({total_sales:.0f} estimated sales)</sub>',
            x=0.5,
            xanchor='center'
        ),
        xaxis=dict(
            title='Estimated Annual Revenue (£ millions)',
            tickformat='.2f',
            ticksuffix='m'
        ),
        yaxis=dict(title=''),
        height=350,
        width=700,
        margin=dict(l=180, r=80, t=80, b=40),
        plot_bgcolor='white'
    )

    return fig


def create_html_report(df):
    """Create comprehensive HTML report."""
    print("Creating HTML report...")

    # Calculate summary stats
    total_revenue = df['allocated_revenue'].sum()
    total_sales = df['estimated_sales'].sum()
    constituencies_with_impact = len(df[df['estimated_sales'] > 0])

    edinburgh_df = df[df['council'] == 'City of Edinburgh']
    edinburgh_revenue = edinburgh_df['allocated_revenue'].sum()
    edinburgh_share = edinburgh_revenue / total_revenue * 100

    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Scottish Mansion Tax - Parliament Constituency Analysis</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Oxygen, Ubuntu, sans-serif;
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
        h1 {{
            margin: 0 0 10px 0;
            font-size: 28px;
        }}
        .subtitle {{
            opacity: 0.9;
            font-size: 16px;
        }}
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
        .stat-value {{
            font-size: 32px;
            font-weight: bold;
            color: #2E86AB;
        }}
        .stat-label {{
            color: #666;
            margin-top: 5px;
        }}
        .section {{
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        h2 {{
            color: #1A535C;
            border-bottom: 2px solid #4ECDC4;
            padding-bottom: 10px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        th {{
            background: #2E86AB;
            color: white;
            padding: 12px;
            text-align: left;
        }}
        td {{
            padding: 10px 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .highlight {{
            background: #e3f2fd;
        }}
        .policy-box {{
            background: #f8f9fa;
            border-left: 4px solid #4ECDC4;
            padding: 15px;
            margin: 20px 0;
        }}
        .footer {{
            text-align: center;
            color: #666;
            padding: 20px;
            font-size: 14px;
        }}
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
                <li><strong>Affected households:</strong> &lt;1% of Scottish households</li>
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
                <th>Band I</th>
                <th>Band J</th>
                <th>Revenue</th>
                <th>Share</th>
            </tr>
"""

    for i, row in df.head(20).iterrows():
        rank = df.index.get_loc(i) + 1
        highlight = ' class="highlight"' if row['council'] == 'City of Edinburgh' else ''
        html += f"""            <tr{highlight}>
                <td>{rank}</td>
                <td><strong>{row['constituency']}</strong></td>
                <td>{row['council']}</td>
                <td>{row['estimated_sales']:.1f}</td>
                <td>{row['band_i_sales']:.1f}</td>
                <td>{row['band_j_sales']:.1f}</td>
                <td>£{row['allocated_revenue']/1e6:.2f}m</td>
                <td>{row['share_pct']:.1f}%</td>
            </tr>
"""

    html += """        </table>
    </div>

    <div class="section">
        <h2>Edinburgh Breakdown</h2>
        <p>Edinburgh constituencies account for over half of the total impact:</p>
        <table>
            <tr>
                <th>Constituency</th>
                <th>Key Areas</th>
                <th>Est. Sales</th>
                <th>Revenue</th>
                <th>Share of Edinburgh</th>
            </tr>
"""

    edinburgh_total = edinburgh_df['allocated_revenue'].sum()
    edinburgh_areas = {
        'Edinburgh Central': 'New Town (EH3), West End',
        'Edinburgh Western': 'Barnton, Cramond (EH4)',
        'Edinburgh Southern': 'Morningside, Grange, Merchiston',
        'Edinburgh Pentlands': 'Corstorphine, Juniper Green',
        'Edinburgh Northern and Leith': 'Trinity, Leith, Inverleith',
        'Edinburgh Eastern': 'Portobello, Duddingston'
    }

    for _, row in edinburgh_df.sort_values('estimated_sales', ascending=False).iterrows():
        area_desc = edinburgh_areas.get(row['constituency'], '')
        share_of_edin = row['allocated_revenue'] / edinburgh_total * 100
        html += f"""            <tr>
                <td><strong>{row['constituency']}</strong></td>
                <td>{area_desc}</td>
                <td>{row['estimated_sales']:.0f}</td>
                <td>£{row['allocated_revenue']/1e6:.2f}m</td>
                <td>{share_of_edin:.0f}%</td>
            </tr>
"""

    html += f"""        </table>
        <p><strong>Edinburgh Total:</strong> {edinburgh_df['estimated_sales'].sum():.0f} sales, £{edinburgh_total/1e6:.2f}m ({edinburgh_share:.1f}% of Scotland)</p>
    </div>

    <div class="section">
        <h2>Full Constituency Data</h2>
        <table>
            <tr>
                <th>Constituency</th>
                <th>Council</th>
                <th>Est. Sales</th>
                <th>Revenue</th>
            </tr>
"""

    for _, row in df.iterrows():
        if row['estimated_sales'] > 0:
            html += f"""            <tr>
                <td>{row['constituency']}</td>
                <td>{row['council']}</td>
                <td>{row['estimated_sales']:.1f}</td>
                <td>£{row['allocated_revenue']/1e6:.2f}m</td>
            </tr>
"""

    html += """        </table>
    </div>

    <div class="section">
        <h2>Methodology</h2>
        <p>This analysis distributes council-level mansion tax estimates to Scottish Parliament constituencies using <strong>wealth-adjusted allocation</strong>:</p>
        <ul>
            <li>Council-level £1m+ property sales data from Registers of Scotland (391 sales)</li>
            <li>Constituency-to-council geographic mapping (2021 boundaries)</li>
            <li>Population weights from NRS Scottish Parliamentary Constituency Estimates (mid-2021)</li>
            <li><strong>Wealth factors</strong> from Council Tax Band F-H data (<a href="https://statistics.gov.scot">statistics.gov.scot</a>, 2023)</li>
        </ul>
        <p>Within each council, revenue is allocated using: <code>Weight = (Population × Wealth Factor) / Council Total</code></p>
        <p>Wealth Factor = constituency Band F-H % ÷ Scotland average (13.8%). Band F-H properties are the highest council tax bands, serving as a proxy for high-value property concentration.</p>
    </div>

    <div class="footer">
        Analysis based on Scottish Government Budget 2026-27 proposals<br>
        Data: Registers of Scotland property transactions | Scottish Parliament 2021 constituency boundaries
    </div>
</body>
</html>"""

    return html


def main():
    """Main execution."""
    print("=" * 60)
    print("Scottish Mansion Tax - Parliament Constituency Visualization")
    print("=" * 60)

    # Load data
    df = load_constituency_data()
    if df is None:
        return

    # Create bar chart
    bar_fig = create_bar_chart(df)
    bar_fig.write_html("scottish_parliament_mansion_tax_bar.html")
    print("Saved: scottish_parliament_mansion_tax_bar.html")

    try:
        bar_fig.write_image("scottish_parliament_mansion_tax_bar.png", width=1000, height=800)
        print("Saved: scottish_parliament_mansion_tax_bar.png")
    except Exception as e:
        print(f"Could not save PNG (install kaleido): {e}")

    # Create council breakdown
    council_fig = create_council_breakdown_chart(df)
    council_fig.write_html("scottish_mansion_tax_council_breakdown.html")
    print("Saved: scottish_mansion_tax_council_breakdown.html")

    # Create Edinburgh breakdown
    edin_fig = create_edinburgh_breakdown(df)
    edin_fig.write_html("scottish_mansion_tax_edinburgh.html")
    print("Saved: scottish_mansion_tax_edinburgh.html")

    # Create HTML report
    html_report = create_html_report(df)
    with open("scottish_parliament_constituency_report.html", "w") as f:
        f.write(html_report)
    print("Saved: scottish_parliament_constituency_report.html")

    print("\n" + "=" * 60)
    print("Visualization complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
