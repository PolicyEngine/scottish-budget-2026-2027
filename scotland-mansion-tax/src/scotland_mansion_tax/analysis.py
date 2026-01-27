"""
Core analysis module for Scottish Mansion Tax - Band H property distribution.

We use Council Tax Band H as a proxy for £1m+ properties:
- Band H threshold: >£212k in 1991 ≈ ~£1m today
- Scotland has 16,011 Band H properties across 2.83M dwellings (0.57%)

Data source: National Records of Scotland Small Area Statistics 2024
"""

from pathlib import Path
from typing import Optional

import pandas as pd

from scotland_mansion_tax.data import load_wealth_factors, get_data_dir


# Constituency to council mapping (Scottish Parliament 2021 boundaries)
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
    # East Dunbartonshire
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
    # Highland - 3 constituencies
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
    # Clackmannanshire
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


def generate_band_h_csv(
    data_dir: Optional[Path] = None,
    output_path: Optional[Path] = None,
    verbose: bool = True
) -> pd.DataFrame:
    """Generate CSV with Band H properties by constituency.

    Args:
        data_dir: Directory containing NRS data files.
        output_path: Where to save the CSV. If None, returns DataFrame only.
        verbose: Print progress messages.

    Returns:
        DataFrame with constituency, council, band_h_properties,
        total_dwellings, pct_band_h.
    """
    if data_dir is None:
        data_dir = get_data_dir()

    if verbose:
        print("Loading Band H data from NRS...")

    # Load dwelling estimates with Band H
    dwelling_file = data_dir / "dwelling_estimates_by_dz.xlsx"
    df = pd.read_excel(dwelling_file, sheet_name="2023", header=4)
    df.columns = df.columns.str.replace("\n", " ").str.strip()

    dz_data = df[["Data Zone code", "Total number of dwellings", "Council Tax band: H"]].copy()
    dz_data.columns = ["DataZone", "TotalDwellings", "BandH"]
    dz_data = dz_data.dropna(subset=["DataZone"])

    # Load DZ to Constituency lookup
    lookup = pd.read_csv(data_dir / "dz_to_constituency_lookup.csv")

    # Merge and aggregate
    merged = dz_data.merge(lookup, on="DataZone", how="left")
    constituency_data = merged.groupby("ConstituencyCode").agg({
        "TotalDwellings": "sum",
        "BandH": "sum"
    }).reset_index()

    # Load constituency names
    names = pd.read_csv(data_dir / "constituency_names.csv")
    name_lookup = dict(zip(names["Code"], names["Name"]))

    # Build output
    results = []
    for _, row in constituency_data.iterrows():
        name = name_lookup.get(row["ConstituencyCode"], row["ConstituencyCode"])
        total = int(row["TotalDwellings"])
        band_h = int(row["BandH"])
        pct = (band_h / total * 100) if total > 0 else 0
        council = CONSTITUENCY_COUNCIL_MAPPING.get(name, "Unknown")
        results.append({
            "constituency": name,
            "council": council,
            "band_h_properties": band_h,
            "total_dwellings": total,
            "pct_band_h": round(pct, 4)
        })

    out_df = pd.DataFrame(results)
    out_df = out_df.sort_values("pct_band_h", ascending=False)

    if verbose:
        total_band_h = out_df['band_h_properties'].sum()
        total_dwellings = out_df['total_dwellings'].sum()
        print(f"Scotland total: {total_band_h:,} Band H properties")
        print(f"Scotland total: {total_dwellings:,} dwellings")
        print(f"Scotland average: {total_band_h / total_dwellings * 100:.2f}%")
        print()
        print("Top 5 by % Band H:")
        for _, row in out_df.head(5).iterrows():
            print(f"  {row['constituency']}: {row['pct_band_h']:.2f}%")

    if output_path:
        out_df.to_csv(output_path, index=False)
        if verbose:
            print(f"\nSaved to {output_path}")

    return out_df
