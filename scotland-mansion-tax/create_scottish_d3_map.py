#!/usr/bin/env python3
"""
Create D3 map visualization of Scottish Mansion Tax impact by Parliament Constituency.

Generates an interactive D3 map showing the estimated revenue share from the Scottish
Budget 2026-27 council tax reform for £1m+ properties, distributed to the 73 Scottish
Parliament constituencies.
"""

import json
import pandas as pd
from pathlib import Path


def load_geo_json():
    """Load constituency geographic boundaries."""
    print("Loading geographic boundaries...")
    with open('data/scottish_parliament_constituencies.geojson') as f:
        return json.load(f)


def load_impact_data():
    """Load mansion tax impact data."""
    print("Loading mansion tax impact data...")
    impact_file = 'scottish_parliament_constituency_impact.csv'

    if not Path(impact_file).exists():
        print(f"ERROR: {impact_file} not found")
        print("Run: python analyze_scottish_parliament_constituencies.py")
        return None

    df = pd.read_csv(impact_file)
    print(f"Loaded data for {len(df)} constituencies")
    return df


def generate_d3_map_html(geojson, impact_data):
    """Generate D3 HTML map with geographic view."""

    # Prepare impact data as JavaScript object - key by constituency name
    impact_js = {}
    for _, row in impact_data.iterrows():
        impact_js[row['constituency']] = {
            'pct': row['share_pct'],
            'num': row['estimated_sales'],
            'rev': row['allocated_revenue'],
            'council': row['council']
        }

    # Get all constituency names for search
    all_constituencies = sorted(impact_data['constituency'].tolist())

    html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scottish Mansion Tax by Parliament Constituency</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Roboto', sans-serif;
            background: white;
        }
        .map-wrapper {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px;
            max-width: 900px;
            margin: 0 auto;
        }
        .map-header {
            padding-bottom: 6px;
            border-bottom: 1px solid #e5e7eb;
        }
        .map-header h2 {
            margin: 0 0 2px 0;
            color: #374151;
            font-size: 0.9rem;
            font-weight: 600;
        }
        .map-header p {
            margin: 0;
            color: #6b7280;
            font-size: 0.75rem;
        }
        .map-top-bar {
            display: flex;
            gap: 16px;
            align-items: center;
            flex-wrap: wrap;
        }
        .map-search-section {
            flex: 1;
            min-width: 180px;
            max-width: 250px;
        }
        .map-search-section h3 {
            font-size: 0.75rem;
            font-weight: 600;
            color: #374151;
            margin: 0 0 4px 0;
        }
        .search-container {
            position: relative;
        }
        .constituency-search {
            width: 100%;
            padding: 6px 10px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 0.75rem;
            font-family: 'Roboto', sans-serif;
        }
        .constituency-search:focus {
            outline: none;
            border-color: #2E86AB;
            box-shadow: 0 0 0 3px rgba(46, 134, 171, 0.1);
        }
        .search-results {
            position: absolute;
            z-index: 100;
            width: 100%;
            margin-top: 4px;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-height: 200px;
            overflow-y: auto;
            display: none;
        }
        .search-result-item {
            width: 100%;
            text-align: left;
            padding: 10px 12px;
            background: none;
            border: none;
            border-bottom: 1px solid #f3f4f6;
            cursor: pointer;
            font-family: 'Roboto', sans-serif;
        }
        .search-result-item:last-child {
            border-bottom: none;
        }
        .search-result-item:hover {
            background: #f9fafb;
        }
        .result-name {
            font-weight: 500;
            font-size: 0.875rem;
            color: #374151;
        }
        .result-value {
            font-size: 0.75rem;
            color: #6b7280;
            margin-top: 2px;
        }
        .map-legend {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-left: auto;
        }
        .legend-gradient {
            width: 180px;
            height: 12px;
            border-radius: 3px;
            background: linear-gradient(to right, #E8F4F8, #2E86AB, #1A535C);
        }
        .legend-labels {
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            color: #6b7280;
            width: 180px;
        }
        .map-canvas {
            position: relative;
            width: 100%;
            display: flex;
            justify-content: center;
        }
        .map-canvas svg {
            background: #ffffff;
            border-radius: 6px;
            width: 100%;
            height: auto;
            max-width: 700px;
        }
        .constituency-path {
            cursor: pointer;
            transition: opacity 0.1s ease;
        }
        .constituency-path:hover {
            opacity: 0.8;
        }
        .map-controls {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 4px;
            background: white;
            padding: 4px;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .zoom-btn {
            width: 28px;
            height: 28px;
            background: transparent;
            border: none;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #6b7280;
            font-size: 18px;
            font-weight: bold;
        }
        .zoom-btn:hover {
            background: #f3f4f6;
            color: #2E86AB;
        }
        .tooltip {
            position: absolute;
            background: white;
            border: 2px solid #2E86AB;
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            pointer-events: none;
            min-width: 220px;
            transform: translate(-50%, -100%);
            margin-top: -10px;
            z-index: 100;
            display: none;
        }
        .tooltip h4 {
            font-size: 0.9rem;
            font-weight: 600;
            color: #374151;
            margin: 0 0 4px 0;
        }
        .tooltip-council {
            font-size: 0.75rem;
            color: #6b7280;
            margin-bottom: 8px;
        }
        .tooltip-value {
            font-size: 1.25rem;
            font-weight: 700;
            color: #2E86AB;
            margin: 4px 0;
        }
        .tooltip-row {
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: #6b7280;
            margin: 4px 0;
        }
        .source {
            font-size: 0.75rem;
            color: #9ca3af;
            margin-top: 12px;
            text-align: center;
        }
        .source a {
            color: #2E86AB;
            text-decoration: none;
        }
        .source a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="map-wrapper">
        <div class="map-header">
            <h2>Scottish mansion tax by parliament constituency</h2>
            <p>Share of estimated annual revenue from council tax reform for properties valued at £1m+</p>
        </div>

        <div class="map-top-bar">
            <div class="map-search-section">
                <h3>Search constituency</h3>
                <div class="search-container">
                    <input type="text" class="constituency-search" placeholder="Type to search..." id="search-input">
                    <div class="search-results" id="search-results"></div>
                </div>
            </div>

            <div class="map-legend">
                <div class="legend-gradient"></div>
                <div class="legend-labels">
                    <span>0%</span>
                    <span id="max-pct-label">12%</span>
                </div>
            </div>
        </div>

        <div class="map-canvas">
            <svg id="map" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="map-controls">
                <button class="zoom-btn" id="zoom-in" title="Zoom in">+</button>
                <button class="zoom-btn" id="zoom-out" title="Zoom out">-</button>
                <button class="zoom-btn" id="zoom-reset" title="Reset">↺</button>
            </div>
            <div class="tooltip" id="tooltip"></div>
        </div>

        <div class="source">
            Source: Analysis based on Scottish Government Budget 2026-27 |
            <a href="https://policyengine.org" target="_blank">PolicyEngine</a>
        </div>
    </div>

    <script>
        const impactData = ''' + json.dumps(impact_js) + ''';

        const geoData = ''' + json.dumps(geojson) + ''';

        const allConstituencies = ''' + json.dumps(all_constituencies) + ''';

        const width = 600;
        const height = 900;

        const svg = d3.select('#map');
        const g = svg.append('g');
        const tooltip = document.getElementById('tooltip');

        // Calculate bounds of British National Grid coordinates
        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        geoData.features.forEach(feature => {
            const traverse = (coords) => {
                if (typeof coords[0] === 'number') {
                    xMin = Math.min(xMin, coords[0]);
                    xMax = Math.max(xMax, coords[0]);
                    yMin = Math.min(yMin, coords[1]);
                    yMax = Math.max(yMax, coords[1]);
                } else {
                    coords.forEach(traverse);
                }
            };
            traverse(feature.geometry.coordinates);
        });

        // Create scale to fit British National Grid into SVG
        const padding = 20;
        const dataWidth = xMax - xMin;
        const dataHeight = yMax - yMin;
        const geoScale = Math.min((width - 2 * padding) / dataWidth, (height - 2 * padding) / dataHeight) * 0.92;
        const geoOffsetX = (width - dataWidth * geoScale) / 2;
        const geoOffsetY = padding;

        const projection = d3.geoTransform({
            point: function(x, y) {
                this.stream.point(
                    (x - xMin) * geoScale + geoOffsetX,
                    height - ((y - yMin) * geoScale + geoOffsetY)
                );
            }
        });

        const pathGenerator = d3.geoPath().projection(projection);

        // Zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Zoom buttons
        document.getElementById('zoom-in').addEventListener('click', () => {
            svg.transition().call(zoom.scaleBy, 1.5);
        });
        document.getElementById('zoom-out').addEventListener('click', () => {
            svg.transition().call(zoom.scaleBy, 0.67);
        });
        document.getElementById('zoom-reset').addEventListener('click', () => {
            svg.transition().call(zoom.transform, d3.zoomIdentity);
        });

        // Color scale
        const maxPct = Math.max(...Object.values(impactData).map(d => d.pct));
        document.getElementById('max-pct-label').textContent = maxPct.toFixed(1) + '%';

        // Use log scale for better variation
        const minPct = 0.01;
        const logScale = d3.scaleLog()
            .domain([minPct, maxPct])
            .range([0, 1])
            .clamp(true);

        const colorScale = (pct) => {
            if (pct === 0 || pct < 0.01) return '#e5e5e5';
            const t = logScale(Math.max(pct, minPct));
            if (t < 0.5) {
                return d3.interpolate('#E8F4F8', '#2E86AB')(t * 2);
            } else {
                return d3.interpolate('#2E86AB', '#1A535C')((t - 0.5) * 2);
            }
        };

        // Draw geographic view
        const geoPaths = g.selectAll('path')
            .data(geoData.features)
            .join('path')
            .attr('class', 'constituency-path')
            .attr('d', pathGenerator)
            .attr('fill', d => {
                const name = d.properties.SPC21NM;
                const data = impactData[name];
                return data ? colorScale(data.pct) : '#e5e5e5';
            })
            .attr('stroke', 'white')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.9)
            .on('mouseenter', function(event, d) {
                const name = d.properties.SPC21NM;
                const data = impactData[name] || { pct: 0, num: 0, rev: 0, council: 'Unknown' };
                showTooltip(name, data, event);
                d3.select(this).attr('opacity', 1).attr('stroke-width', 2);
            })
            .on('mousemove', function(event, d) {
                const name = d.properties.SPC21NM;
                const data = impactData[name] || { pct: 0, num: 0, rev: 0, council: 'Unknown' };
                showTooltip(name, data, event);
            })
            .on('mouseleave', function(event, d) {
                d3.select(this).attr('opacity', 0.9).attr('stroke-width', 0.5);
                hideTooltip();
            });

        function showTooltip(name, data, event) {
            tooltip.innerHTML = `
                <h4>${name}</h4>
                <div class="tooltip-council">${data.council}</div>
                <div class="tooltip-value">£${(data.rev / 1000000).toFixed(2)}m</div>
                <div class="tooltip-row">
                    <span>Share of total</span>
                    <span>${data.pct.toFixed(2)}%</span>
                </div>
            `;
            tooltip.style.display = 'block';

            const rect = document.querySelector('.map-canvas').getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }

        function hideTooltip() {
            tooltip.style.display = 'none';
        }

        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }

            const matches = allConstituencies.filter(name =>
                name.toLowerCase().includes(query)
            ).slice(0, 10);

            if (matches.length === 0) {
                searchResults.style.display = 'none';
                return;
            }

            searchResults.innerHTML = matches.map(name => {
                const data = impactData[name] || { pct: 0, num: 0, rev: 0 };
                return `
                    <button class="search-result-item" data-name="${name}">
                        <div class="result-name">${name}</div>
                        <div class="result-value">£${(data.rev / 1000000).toFixed(2)}m | ${data.pct.toFixed(2)}%</div>
                    </button>
                `;
            }).join('');

            searchResults.style.display = 'block';

            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', function() {
                    const name = this.dataset.name;
                    searchInput.value = name;
                    searchResults.style.display = 'none';

                    const data = impactData[name] || { pct: 0, num: 0, rev: 0, council: 'Unknown' };
                    tooltip.innerHTML = `
                        <h4>${name}</h4>
                        <div class="tooltip-council">${data.council}</div>
                        <div class="tooltip-value">£${(data.rev / 1000000).toFixed(2)}m</div>
                        <div class="tooltip-row"><span>Share of total</span><span>${data.pct.toFixed(2)}%</span></div>
                    `;
                    tooltip.style.display = 'block';
                    tooltip.style.left = '50%';
                    tooltip.style.top = '50%';

                    // Reset all opacity
                    g.selectAll('.constituency-path').attr('opacity', 0.9).attr('stroke-width', 0.5);
                    // Highlight selected
                    g.selectAll('.constituency-path')
                        .filter(d => d.properties.SPC21NM === name)
                        .attr('opacity', 1).attr('stroke-width', 2);

                    // Zoom to constituency
                    const feature = geoData.features.find(f => f.properties.SPC21NM === name);
                    if (feature) {
                        const bounds = pathGenerator.bounds(feature);
                        const dx = bounds[1][0] - bounds[0][0];
                        const dy = bounds[1][1] - bounds[0][1];
                        const x = (bounds[0][0] + bounds[1][0]) / 2;
                        const y = (bounds[0][1] + bounds[1][1]) / 2;
                        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
                        svg.transition().duration(750).call(
                            zoom.transform,
                            d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-x, -y)
                        );
                    }
                });
            });
        });

        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    </script>
</body>
</html>'''

    return html_template


def main():
    """Main execution."""
    print("=" * 70)
    print("Scottish Mansion Tax - D3 Map Visualization")
    print("=" * 70)

    geojson = load_geo_json()
    impact_data = load_impact_data()

    if impact_data is None:
        return

    print("Generating D3 map...")
    html_content = generate_d3_map_html(geojson, impact_data)

    output_file = 'scottish_mansion_tax_map.html'
    with open(output_file, 'w') as f:
        f.write(html_content)
    print(f"Saved {output_file}")

    print("\n" + "=" * 70)
    print("Visualization complete!")
    print("=" * 70)
    print(f"\nTo view the map locally:")
    print(f"  python -m http.server 8000")
    print(f"  Then open: http://localhost:8000/{output_file}")


if __name__ == '__main__':
    main()
