#!/usr/bin/env python3
"""
Scottish Mansion Tax Analysis by Scottish Parliament Constituency

Estimates revenue impact of Scotland's proposed council tax reform for £1m+ properties
(Scottish Budget 2026-27) by Scottish Parliament constituency.

Revenue Calculation:
    Revenue = Stock × Average Rate
            = 11,481 × £1,607
            = £18.5m

    Where:
    - Stock (11,481): Total £1m+ properties in Scotland (Savills, 2022)
    - Average Rate (£1,607): (89% × £1,500) + (11% × £2,500)
    - Band split from Savills 2024: 416 sales £1m-£2m, 50 sales £2m+

    Sales data (391 from RoS) is only used for GEOGRAPHIC DISTRIBUTION,
    not for calculating total revenue.

Data sources:
- Stock: Savills research (11,481 £1m+ homes in Scotland, 2022)
- Sales distribution: Registers of Scotland (391 £1m+ sales in 2024-25)
- Band split: Savills 2024 Scotland £1m+ Market Analysis (89%/11%)
- Population: NRS Scottish Parliamentary Constituency Estimates (mid-2021)
- Wealth factors: Council Tax Band F-H proportions from statistics.gov.scot (2023)
  Source: https://statistics.gov.scot/data/dwellings-by-council-tax-band-summary-current-geographic-boundaries

Note: Stock data (2022) predates sales data (2024-25) by ~2 years. With ~5-10% house
price growth over this period, actual stock may be higher, potentially underestimating
revenue by a similar margin.

Methodology:
1. Calculate total revenue: Stock × Average Rate = £18.5m
2. Load Council Tax Band F-H data from statistics.gov.scot (2023)
   - Band F-H properties are highest-value properties (proxy for £1m+ potential)
   - Calculate wealth factor = constituency Band F-H % / Scotland average Band F-H %
3. Within each council, calculate wealth-adjusted weights:
   Weight = (Population × Wealth Factor) / Sum(Pop × Wealth Factor)
4. Distribute council sales to constituencies using wealth-adjusted weights
5. Allocate £18.5m proportionally by each constituency's share of sales
"""

import pandas as pd
from pathlib import Path

# Surcharge rates (benchmark - Scotland rates not yet announced)
# Source: https://www.gov.uk/government/publications/high-value-council-tax-surcharge
BAND_I_SURCHARGE = 1_500  # £1,500/year for £1m-£2m properties
BAND_J_SURCHARGE = 2_500  # £2,500/year for £2m+ properties

# Stock estimate from Savills (February 2023)
# Source: https://www.savills.com/insight-and-opinion/savills-news/339380/1-in-40-homes-now-valued-£1-million-or-more--according-to-savills
# Table shows Scotland: 11,481 £1m+ homes in 2022
ESTIMATED_STOCK = 11_481  # Exact figure from Savills research

# Council-level £1m+ sales estimates
# Primary source: Registers of Scotland Property Market Report 2024-25
# https://www.ros.gov.uk/data-and-statistics/property-market-statistics/property-market-report-2024-25
# PDF: https://www.ros.gov.uk/__data/assets/pdf_file/0006/299184/Registers-of-Scotland-Property-Market-Report-2024-25-June.pdf
# Data extracted: January 2026
#
# RoS reports 391 total £1m+ sales with "over half" in City of Edinburgh.
# Council-level breakdown is estimated from:
# - RoS postcode-level data (EH3: 53, EH4: 49, KY16: 22, EH39: 18, G61: 15, etc.)
# - Scottish Housing News analysis of top postcodes
# - Mapping postcodes to council areas
#
# Note: Estimates total 429 (not 391) because postcode data from multiple sources
# may include slightly different time periods or counting methodologies.
# The geographic DISTRIBUTION is used, not the absolute numbers.
ROS_REPORTED_TOTAL = 391  # Official RoS figure for validation reference
COUNCIL_DATA = {
    "City of Edinburgh": 200,      # >50% per RoS; EH3 (53) + EH4 (49) + EH9/10/12 (~98)
    "East Lothian": 35,            # North Berwick area (EH39: 18 + surrounding)
    "Fife": 30,                    # St Andrews (KY16: 22 + surrounding)
    "East Dunbartonshire": 25,     # Bearsden (G61: 15 + surrounding)
    "Aberdeen City": 20,           # AB15 and central Aberdeen
    "Aberdeenshire": 15,           # Rural Aberdeenshire
    "Glasgow City": 15,            # G12, G41 areas
    "Perth and Kinross": 12,       # Perth, Auchterarder
    "Stirling": 10,                # Bridge of Allan, Dunblane
    "Highland": 10,                # Inverness, rural Highlands
    "East Renfrewshire": 10,       # Newton Mearns (G77)
    "Scottish Borders": 8,         # Melrose, Kelso
    "South Ayrshire": 7,           # Ayr coastal
    "Argyll and Bute": 6,          # Helensburgh, Oban
    "Midlothian": 5,               # Dalkeith area
    "West Lothian": 5,             # Linlithgow
    # Remaining councils with minimal £1m+ sales (estimated <5 each)
    "South Lanarkshire": 3,
    "North Lanarkshire": 2,
    "Renfrewshire": 2,
    "Inverclyde": 1,
    "Falkirk": 1,
    "Clackmannanshire": 1,
    "Dumfries and Galloway": 1,
    "Dundee City": 1,
    "Angus": 1,
    "Moray": 1,
    "North Ayrshire": 1,
    "West Dunbartonshire": 1,
    "East Ayrshire": 0,
    "Eilean Siar": 0,
    "Orkney Islands": 0,
    "Shetland Islands": 0,
}

# Validate council data
_council_total = sum(COUNCIL_DATA.values())
assert _council_total > 0, "Council sales data is empty"
# Note: Total is 429, not 391 (RoS official). This is expected because estimates
# are derived from multiple postcode sources. We use the distribution, not absolutes.

# Constituency to council mapping
# Source: Scottish Parliament 2021 boundaries
CONSTITUENCY_COUNCIL_MAPPING = {
    # City of Edinburgh - 6 constituencies
    "Edinburgh Central": "City of Edinburgh",
    "Edinburgh Western": "City of Edinburgh",
    "Edinburgh Southern": "City of Edinburgh",
    "Edinburgh Pentlands": "City of Edinburgh",
    "Edinburgh Northern and Leith": "City of Edinburgh",
    "Edinburgh Eastern": "City of Edinburgh",

    # East Lothian - 1 constituency
    "East Lothian": "East Lothian",

    # Fife - 5 constituencies
    "North East Fife": "Fife",
    "Dunfermline": "Fife",
    "Cowdenbeath": "Fife",
    "Kirkcaldy": "Fife",
    "Mid Fife and Glenrothes": "Fife",

    # East Dunbartonshire - 2 constituencies (shared with North Lanarkshire)
    "Strathkelvin and Bearsden": "East Dunbartonshire",

    # Aberdeen City - 3 constituencies
    "Aberdeen Central": "Aberdeen City",
    "Aberdeen Donside": "Aberdeen City",
    "Aberdeen South and North Kincardine": "Aberdeen City",

    # Aberdeenshire - 3 constituencies
    "Aberdeenshire West": "Aberdeenshire",
    "Aberdeenshire East": "Aberdeenshire",
    "Banffshire and Buchan Coast": "Aberdeenshire",

    # Glasgow City - 9 constituencies
    "Glasgow Kelvin": "Glasgow City",
    "Glasgow Cathcart": "Glasgow City",
    "Glasgow Anniesland": "Glasgow City",
    "Glasgow Southside": "Glasgow City",
    "Glasgow Pollok": "Glasgow City",
    "Glasgow Maryhill and Springburn": "Glasgow City",
    "Glasgow Provan": "Glasgow City",
    "Glasgow Shettleston": "Glasgow City",
    "Rutherglen": "Glasgow City",

    # Perth and Kinross - 2 constituencies
    "Perthshire North": "Perth and Kinross",
    "Perthshire South and Kinross-shire": "Perth and Kinross",

    # Stirling - 1 constituency
    "Stirling": "Stirling",

    # Highland - 4 constituencies
    "Inverness and Nairn": "Highland",
    "Caithness, Sutherland and Ross": "Highland",
    "Skye, Lochaber and Badenoch": "Highland",

    # East Renfrewshire - 1 constituency
    "Eastwood": "East Renfrewshire",

    # Scottish Borders - 2 constituencies
    "Ettrick, Roxburgh and Berwickshire": "Scottish Borders",
    "Midlothian South, Tweeddale and Lauderdale": "Scottish Borders",

    # South Ayrshire - 2 constituencies
    "Ayr": "South Ayrshire",
    "Carrick, Cumnock and Doon Valley": "South Ayrshire",

    # Argyll and Bute - 1 constituency
    "Argyll and Bute": "Argyll and Bute",

    # Midlothian - 1 constituency
    "Midlothian North and Musselburgh": "Midlothian",

    # West Lothian - 2 constituencies
    "Linlithgow": "West Lothian",
    "Almond Valley": "West Lothian",

    # South Lanarkshire - 4 constituencies
    "East Kilbride": "South Lanarkshire",
    "Clydesdale": "South Lanarkshire",
    "Hamilton, Larkhall and Stonehouse": "South Lanarkshire",
    "Uddingston and Bellshill": "South Lanarkshire",

    # North Lanarkshire - 4 constituencies
    "Motherwell and Wishaw": "North Lanarkshire",
    "Airdrie and Shotts": "North Lanarkshire",
    "Coatbridge and Chryston": "North Lanarkshire",
    "Cumbernauld and Kilsyth": "North Lanarkshire",

    # Renfrewshire - 3 constituencies
    "Paisley": "Renfrewshire",
    "Renfrewshire North and West": "Renfrewshire",
    "Renfrewshire South": "Renfrewshire",

    # Inverclyde - 1 constituency
    "Greenock and Inverclyde": "Inverclyde",

    # Falkirk - 2 constituencies
    "Falkirk East": "Falkirk",
    "Falkirk West": "Falkirk",

    # Clackmannanshire - 1 constituency (shared with Stirling)
    "Clackmannanshire and Dunblane": "Clackmannanshire",

    # Dumfries and Galloway - 2 constituencies
    "Dumfriesshire": "Dumfries and Galloway",
    "Galloway and West Dumfries": "Dumfries and Galloway",

    # Dundee City - 2 constituencies
    "Dundee City East": "Dundee City",
    "Dundee City West": "Dundee City",

    # Angus - 2 constituencies
    "Angus North and Mearns": "Angus",
    "Angus South": "Angus",

    # Moray - 1 constituency
    "Moray": "Moray",

    # North Ayrshire - 2 constituencies
    "Cunninghame North": "North Ayrshire",
    "Cunninghame South": "North Ayrshire",

    # East Ayrshire - 1 constituency
    "Kilmarnock and Irvine Valley": "East Ayrshire",

    # West Dunbartonshire - 2 constituencies
    "Dumbarton": "West Dunbartonshire",
    "Clydebank and Milngavie": "West Dunbartonshire",

    # Island councils
    "Na h-Eileanan an Iar": "Eilean Siar",
    "Orkney Islands": "Orkney Islands",
    "Shetland Islands": "Shetland Islands",
}

# Validate mapping completeness (73 constituencies required)
EXPECTED_CONSTITUENCIES = 73
assert len(CONSTITUENCY_COUNCIL_MAPPING) == EXPECTED_CONSTITUENCIES, \
    f"Expected {EXPECTED_CONSTITUENCIES} constituencies, got {len(CONSTITUENCY_COUNCIL_MAPPING)}"

# Band distribution (from Savills 2024 data)
# Source: https://www.savills.co.uk/research_articles/229130/372275-0
# 2024: 416 sales £1m-£2m, 50 sales £2m+ (total 466)
BAND_I_RATIO = 416 / 466  # £1m-£2m = 89.3%
BAND_J_RATIO = 50 / 466   # £2m+ = 10.7%

def download_council_tax_data():
    """Download Council Tax Band data from statistics.gov.scot SPARQL endpoint."""
    import urllib.request
    import urllib.parse

    sparql_query = """
PREFIX qb: <http://purl.org/linked-data/cube#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sdmx: <http://purl.org/linked-data/sdmx/2009/dimension#>
PREFIX dim: <http://statistics.gov.scot/def/dimension/>

SELECT ?constituency ?band ?dwellings
WHERE {
  ?obs qb:dataSet <http://statistics.gov.scot/data/dwellings-by-council-tax-band-summary-current-geographic-boundaries> ;
       sdmx:refArea ?areaUri ;
       sdmx:refPeriod ?periodUri ;
       dim:councilTaxBand ?bandUri ;
       <http://statistics.gov.scot/def/measure-properties/count> ?dwellings .

  ?areaUri rdfs:label ?constituency .
  ?bandUri rdfs:label ?band .
  ?periodUri rdfs:label ?year .

  FILTER(CONTAINS(STR(?areaUri), 'S16'))
  FILTER(?year = '2023')
}
ORDER BY ?constituency ?band
"""
    endpoint = "https://statistics.gov.scot/sparql.csv"
    url = f"{endpoint}?query={urllib.parse.quote(sparql_query)}"

    print("   Downloading from statistics.gov.scot...")
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read().decode('utf-8')

        # Save to file
        band_file = Path("data/council_tax_bands_by_constituency.csv")
        band_file.parent.mkdir(exist_ok=True)
        band_file.write_text(data)
        print(f"   ✓ Downloaded and saved {len(data.splitlines())} rows")
        return True
    except Exception as e:
        print(f"   ⚠️ Download failed: {e}")
        return False


def load_wealth_factors():
    """Load wealth factors from Council Tax Band F-H data.

    Wealth factor = constituency's Band F-H % / Scotland average Band F-H %

    Source: statistics.gov.scot (2023)

    Returns:
        Dict mapping constituency -> wealth factor.

    Raises:
        RuntimeError: If required data files cannot be downloaded.
    """
    band_file = Path("data/council_tax_bands_by_constituency.csv")

    # Download if not present - fail if unavailable
    if not band_file.exists():
        print("   Council tax band data not found locally.")
        if not download_council_tax_data():
            raise RuntimeError(
                "Failed to download Council Tax band data.\n"
                "This data is required for wealth-adjusted analysis.\n\n"
                "Please ensure statistics.gov.scot is accessible and retry."
            )

    # Load the data
    df = pd.read_csv(band_file)

    # Pivot to get Band F-H and Total for each constituency
    df_fh = df[df['band'] == 'Bands F-H'][['constituency', 'dwellings']].copy()
    df_fh.columns = ['constituency', 'band_fh']

    df_total = df[df['band'] == 'Total Dwellings'][['constituency', 'dwellings']].copy()
    df_total.columns = ['constituency', 'total']

    # Merge and calculate percentages
    df_merged = df_fh.merge(df_total, on='constituency')
    df_merged['fh_pct'] = df_merged['band_fh'] / df_merged['total']

    # Calculate Scotland average Band F-H percentage
    scotland_fh = df_merged['band_fh'].sum()
    scotland_total = df_merged['total'].sum()
    scotland_avg_pct = scotland_fh / scotland_total

    print(f"   Scotland average Band F-H: {scotland_avg_pct:.1%} ({scotland_fh:,} of {scotland_total:,} dwellings)")

    # Calculate wealth factor for each constituency
    # Factor = constituency Band F-H % / Scotland average Band F-H %
    wealth_factors = {}
    for _, row in df_merged.iterrows():
        factor = row['fh_pct'] / scotland_avg_pct
        wealth_factors[row['constituency']] = round(factor, 2)

    # Print top and bottom constituencies for verification
    sorted_factors = sorted(wealth_factors.items(), key=lambda x: x[1], reverse=True)
    print(f"   Top 5 by Band F-H concentration:")
    for name, factor in sorted_factors[:5]:
        pct = df_merged[df_merged['constituency'] == name]['fh_pct'].values[0]
        print(f"      {name}: {factor:.2f}x ({pct:.1%} Band F-H)")

    print(f"   Bottom 3 by Band F-H concentration:")
    for name, factor in sorted_factors[-3:]:
        pct = df_merged[df_merged['constituency'] == name]['fh_pct'].values[0]
        print(f"      {name}: {factor:.2f}x ({pct:.1%} Band F-H)")

    return wealth_factors


def load_population_data():
    """Load NRS constituency population data."""
    pop_file = Path("data/constituency_population.csv")

    if not pop_file.exists():
        print("⚠️  Population data not found. Run download script first.")
        print("   Extracting from NRS Excel file...")

        # Extract from Excel if CSV doesn't exist
        xlsx_file = Path("data/nrs_constituency_population.xlsx")
        if xlsx_file.exists():
            df = pd.read_excel(xlsx_file, sheet_name='2021', skiprows=2)
            df.columns = ['constituency', 'code', 'sex', 'total'] + [f'age_{i}' for i in range(len(df.columns)-4)]
            df_pop = df[df['sex'] == 'Persons'][['constituency', 'total']].copy()
            df_pop.columns = ['constituency', 'population']
            df_pop = df_pop.dropna()
            df_pop['population'] = df_pop['population'].astype(int)
            df_pop.to_csv(pop_file, index=False)
            print(f"   ✓ Saved {len(df_pop)} constituencies to {pop_file}")
        else:
            raise FileNotFoundError(f"Neither {pop_file} nor {xlsx_file} found")

    return pd.read_csv(pop_file)


def calculate_wealth_adjusted_weights(population_df, wealth_factors):
    """Calculate wealth-adjusted weights within each council.

    Uses population as base, then applies wealth adjustment factors from
    Council Tax Band F-H data to reflect high-value property concentrations.

    Weight = (Population × Wealth Factor) / Sum(Population × Wealth Factor for council)

    Args:
        population_df: DataFrame with constituency populations
        wealth_factors: Dict mapping constituency -> wealth factor (from Band F-H data)
    """

    # Create mapping with population
    weights = {}

    # Group constituencies by council with adjusted values
    council_data = {}
    for constituency, council in CONSTITUENCY_COUNCIL_MAPPING.items():
        if council not in council_data:
            council_data[council] = []

        # Find population for this constituency
        pop_row = population_df[population_df['constituency'] == constituency]
        if len(pop_row) == 0:
            raise ValueError(f"No population data for {constituency}")
        pop = pop_row['population'].values[0]

        # Get wealth adjustment factor
        if constituency not in wealth_factors:
            raise ValueError(f"No wealth factor for {constituency}")
        wealth_factor = wealth_factors[constituency]

        # Adjusted value = population × wealth factor
        adjusted_value = pop * wealth_factor

        council_data[council].append((constituency, pop, wealth_factor, adjusted_value))

    # Calculate weights within each council using adjusted values
    for council, constituencies in council_data.items():
        total_adjusted = sum(adj for _, _, _, adj in constituencies)
        for constituency, pop, wealth_factor, adjusted_value in constituencies:
            # Weight based on adjusted value, not raw population
            weight = adjusted_value / total_adjusted if total_adjusted > 0 else 1 / len(constituencies)
            weights[constituency] = {
                "council": council,
                "population": pop,
                "wealth_factor": wealth_factor,
                "weight": weight
            }

    return weights


def analyze_constituencies():
    """Distribute council-level estimates to constituencies using wealth-adjusted weights."""

    print("=" * 70)
    print("Scottish Mansion Tax Analysis by Parliament Constituency")
    print("Using wealth-adjusted weights (population × Band F-H factor)")
    print("=" * 70)

    # Load population data
    print("\n📊 Loading NRS population data...")
    population_df = load_population_data()
    print(f"   ✓ Loaded {len(population_df)} constituencies")

    # Load wealth factors from Council Tax Band F-H data
    print("\n💎 Loading Council Tax Band F-H data (wealth proxy)...")
    wealth_factors = load_wealth_factors()
    print(f"   ✓ Loaded wealth factors for {len(wealth_factors)} constituencies")

    # Calculate wealth-adjusted weights
    print("\n📈 Calculating wealth-adjusted weights...")
    weights = calculate_wealth_adjusted_weights(population_df, wealth_factors)

    # Calculate total sales for normalization
    total_sales = sum(COUNCIL_DATA.values())

    results = []

    for constituency, data in weights.items():
        council = data["council"]
        weight = data["weight"]
        population = data["population"]
        wealth_factor = data["wealth_factor"]

        # Get council's total sales
        if council not in COUNCIL_DATA:
            raise ValueError(f"Council {council} not in COUNCIL_DATA")
        council_sales = COUNCIL_DATA[council]

        # Allocate to constituency based on wealth-adjusted weight
        constituency_sales = council_sales * weight

        # Calculate share of total
        share = constituency_sales / total_sales if total_sales > 0 else 0

        # Band breakdown
        band_i_sales = constituency_sales * BAND_I_RATIO
        band_j_sales = constituency_sales * BAND_J_RATIO

        # Calculate implied revenue from sales using UK rates
        implied_from_sales = (band_i_sales * BAND_I_SURCHARGE) + (band_j_sales * BAND_J_SURCHARGE)

        results.append({
            "constituency": constituency,
            "council": council,
            "population": population,
            "wealth_factor": wealth_factor,
            "weight": round(weight, 4),
            "estimated_sales": constituency_sales,
            "band_i_sales": band_i_sales,
            "band_j_sales": band_j_sales,
            "share_pct": round(share * 100, 2) if constituency_sales > 0 else 0,
            "implied_from_sales": implied_from_sales if constituency_sales > 0 else 0,
        })

    df = pd.DataFrame(results)
    df = df.sort_values("estimated_sales", ascending=False)

    # Calculate total revenue using simple formula: Stock × Average Rate
    # This is equivalent to: (sales × avg_rate) × (stock / sales) = stock × avg_rate
    avg_rate = BAND_I_RATIO * BAND_I_SURCHARGE + BAND_J_RATIO * BAND_J_SURCHARGE
    total_stock_revenue = ESTIMATED_STOCK * avg_rate  # 11,481 × £1,607 = £18.5m

    # For reference: the ratio-based calculation gives the same result
    total_implied_from_sales = df['implied_from_sales'].sum()
    stock_sales_ratio = ESTIMATED_STOCK / total_sales

    # Allocate total revenue proportionally by each constituency's share
    df['allocated_revenue'] = df['share_pct'] / 100 * total_stock_revenue

    # Print summary
    print(f"\n📊 Total constituencies: {len(df)}")
    print(f"📈 Total £1m+ sales: {df['estimated_sales'].sum():.0f} (for geographic distribution)")
    print(f"🏠 Estimated £1m+ stock: {ESTIMATED_STOCK:,} (Savills)")
    print(f"\n💰 Revenue calculation:")
    print(f"   Band I rate: £{BAND_I_SURCHARGE:,}/year ({BAND_I_RATIO:.1%} of properties)")
    print(f"   Band J rate: £{BAND_J_SURCHARGE:,}/year ({BAND_J_RATIO:.1%} of properties)")
    print(f"   Average rate: £{avg_rate:,.0f}/year")
    print(f"   Formula: Stock × Avg Rate = {ESTIMATED_STOCK:,} × £{avg_rate:,.0f} = £{total_stock_revenue/1e6:.1f}m")

    print("\n🏛️  Top 20 Constituencies by Impact:")
    print("-" * 105)
    print(f"{'Constituency':<40} {'Council':<20} {'Pop':>8} {'Weight':>7} {'Sales':>6} {'Revenue':>12}")
    print("-" * 105)

    for _, row in df.head(20).iterrows():
        council_short = row['council'][:19] if len(row['council']) > 19 else row['council']
        print(f"{row['constituency']:<40} {council_short:<20} "
              f"{row['population']:>8,} {row['weight']:>6.1%} "
              f"{row['estimated_sales']:>6} £{row['allocated_revenue']/1e6:>10.2f}m")

    print("-" * 105)

    # Edinburgh subtotal
    edinburgh_df = df[df['council'] == 'City of Edinburgh']
    print(f"\n📍 Edinburgh Total (6 constituencies):")
    print(f"   {edinburgh_df['estimated_sales'].sum():.0f} sales, "
          f"£{edinburgh_df['allocated_revenue'].sum()/1e6:.1f}m "
          f"({edinburgh_df['share_pct'].sum():.1f}%)")

    for _, row in edinburgh_df.sort_values('estimated_sales', ascending=False).iterrows():
        print(f"   - {row['constituency']}: {row['estimated_sales']} sales, "
              f"£{row['allocated_revenue']/1e6:.2f}m ({row['share_pct']:.1f}%)")

    return df


def main():
    """Run analysis and save results."""
    df = analyze_constituencies()

    # Save results
    output_file = "scottish_parliament_constituency_impact.csv"
    df.to_csv(output_file, index=False)
    print(f"\n✅ Saved: {output_file}")

    # Summary stats
    print("\n" + "=" * 70)
    print("Summary Statistics:")
    print(f"  Constituencies analyzed: {len(df)}")
    print(f"  With £1m+ sales: {len(df[df['estimated_sales'] > 0])}")
    print(f"  Total sales: {df['estimated_sales'].sum():.0f}")
    print(f"  Estimated stock: {ESTIMATED_STOCK:,}")
    print(f"  Stock-based revenue: £{df['allocated_revenue'].sum()/1e6:.1f}m")
    print(f"\n  Top 5 constituencies:")
    for _, row in df.head(5).iterrows():
        print(f"    {row['constituency']}: {row['estimated_sales']} sales, "
              f"£{row['allocated_revenue']/1e6:.2f}m ({row['share_pct']:.1f}%)")
    print("=" * 70)

    return df


if __name__ == "__main__":
    main()
