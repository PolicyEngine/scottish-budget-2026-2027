"""Data generation pipeline for Scottish Budget dashboard.

This module provides the main pipeline for generating all dashboard data.
"""

from pathlib import Path
from typing import Optional
import pandas as pd
import h5py

from policyengine_uk import Microsimulation
from policyengine_uk.data import UKSingleYearDataset

from scottish_budget_data.calculators import (
    BudgetaryImpactCalculator,
    ConstituencyCalculator,
    DistributionalImpactCalculator,
    MetricsCalculator,
    WinnersLosersCalculator,
)
from scottish_budget_data.reforms import Reform, get_scottish_budget_reforms


# Default paths
DEFAULT_OUTPUT_DIR = Path("public/data")
DEFAULT_DATA_DIR = Path("data")
DEFAULT_DATA_INPUTS_DIR = Path("data_inputs")


def save_csv(df: pd.DataFrame, csv_path: Path) -> None:
    """Save DataFrame to CSV, creating parent directories if needed."""
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    print(f"Saved: {csv_path}")


def generate_all_data(
    reforms: Optional[list[Reform]] = None,
    output_dir: Optional[Path] = None,
    data_dir: Optional[Path] = None,
    data_inputs_dir: Optional[Path] = None,
    years: list[int] = None,
    scotland_only: bool = True,
) -> dict[str, pd.DataFrame]:
    """Generate all dashboard data for the given reforms.

    Args:
        reforms: List of reforms to process. Defaults to Scottish Budget 2026.
        output_dir: Directory for output CSV files.
        data_dir: Directory containing constituency weights.
        data_inputs_dir: Directory containing constituency metadata.
        years: Years to analyze.
        scotland_only: If True, filter to Scottish constituencies only.

    Returns:
        Dict mapping output name to DataFrame.
    """
    reforms = reforms or get_scottish_budget_reforms()
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    data_dir = data_dir or DEFAULT_DATA_DIR
    data_inputs_dir = data_inputs_dir or DEFAULT_DATA_INPUTS_DIR
    years = years or [2026, 2027, 2028, 2029, 2030]

    # Initialize calculators
    budgetary_calc = BudgetaryImpactCalculator(years=years)
    distributional_calc = DistributionalImpactCalculator()
    winners_losers_calc = WinnersLosersCalculator()
    metrics_calc = MetricsCalculator()
    constituency_calc = ConstituencyCalculator()

    # Load constituency data
    weights_path = data_dir / "parliamentary_constituency_weights.h5"
    constituencies_path = data_inputs_dir / "constituencies_2024.csv"

    weights = None
    constituency_df = None

    if weights_path.exists() and constituencies_path.exists():
        with h5py.File(weights_path, "r") as f:
            weights = f["2025"][...]
        constituency_df = pd.read_csv(constituencies_path)

        # Filter to Scottish constituencies if requested
        if scotland_only:
            scottish_mask = constituency_df["code"].str.startswith("S")
            constituency_df = constituency_df[scottish_mask].reset_index(drop=True)
            print(f"Filtering to {len(constituency_df)} Scottish constituencies")

    # Aggregate results
    all_budgetary = []
    all_distributional = []
    all_winners_losers = []
    all_metrics = []
    all_constituency = []

    for reform in reforms:
        print(f"\nProcessing: {reform.name}")

        # Create simulations
        baseline_scenario = reform.to_baseline_scenario()
        reform_scenario = reform.to_scenario()

        if baseline_scenario:
            baseline = Microsimulation(scenario=baseline_scenario)
        else:
            baseline = Microsimulation()

        reformed = Microsimulation(scenario=reform_scenario)

        # Calculate budgetary impact
        budgetary = budgetary_calc.calculate(
            baseline, reformed, reform.id, reform.name
        )
        all_budgetary.extend(budgetary)

        # Calculate per-year metrics
        for year in years:
            print(f"  Year {year}...")

            # Distributional
            distributional, decile_df = distributional_calc.calculate(
                baseline, reformed, reform.id, reform.name, year
            )
            all_distributional.extend(distributional)

            # Winners/losers
            winners_losers = winners_losers_calc.calculate(
                decile_df, reform.id, reform.name, year
            )
            all_winners_losers.extend(winners_losers)

            # Summary metrics (poverty)
            metrics = metrics_calc.calculate(
                baseline, reformed, reform.id, reform.name, year
            )
            all_metrics.extend(metrics)

            # Constituency impacts
            if weights is not None and constituency_df is not None:
                constituency = constituency_calc.calculate(
                    baseline, reformed, reform.id, year, weights, constituency_df
                )
                all_constituency.extend(constituency)

        print(f"  Done: {reform.name}")

    # Create DataFrames
    results = {
        "budgetary_impact": pd.DataFrame(all_budgetary),
        "distributional_impact": pd.DataFrame(all_distributional),
        "winners_losers": pd.DataFrame(all_winners_losers),
        "metrics": pd.DataFrame(all_metrics),
        "constituency": pd.DataFrame(all_constituency),
    }

    # Save to CSV
    for name, df in results.items():
        if len(df) > 0:
            save_csv(df, output_dir / f"{name}.csv")

    print(f"\nAll data saved to {output_dir}/")

    return results


if __name__ == "__main__":
    generate_all_data()
