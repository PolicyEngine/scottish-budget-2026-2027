"""Data generation pipeline for Scottish Budget dashboard.

This module provides the main pipeline for generating all dashboard data.
"""

from pathlib import Path
from typing import Optional
import pandas as pd
import h5py

from policyengine_uk import Microsimulation
from policyengine_uk.data import UKSingleYearDataset

from .calculators import (
    BudgetaryImpactCalculator,
    ConstituencyCalculator,
    DistributionalImpactCalculator,
    MetricsCalculator,
    TwoChildLimitCalculator,
    WinnersLosersCalculator,
)
from .reforms import Reform, get_scottish_budget_reforms, get_two_child_limit_reform


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
    dataset_path: Optional[Path] = None,
) -> dict[str, pd.DataFrame]:
    """Generate all dashboard data for the given reforms.

    Args:
        reforms: List of reforms to process. Defaults to Scottish Budget 2026.
        output_dir: Directory for output CSV files.
        data_dir: Directory containing constituency weights.
        data_inputs_dir: Directory containing constituency metadata.
        years: Years to analyze.
        scotland_only: If True, filter to Scottish constituencies only.
        dataset_path: Path to local enhanced_frs h5 file. If None, downloads from HF.

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
            scottish_indices = scottish_mask.values
            # Filter both weights and constituency_df to Scottish only
            weights = weights[scottish_indices, :]
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

        # Use local dataset if provided, otherwise download from HF
        if dataset_path:
            dataset_obj = UKSingleYearDataset(str(dataset_path))
        else:
            dataset_obj = None

        if baseline_scenario:
            baseline = Microsimulation(scenario=baseline_scenario, dataset=dataset_obj)
        else:
            baseline = Microsimulation(dataset=dataset_obj)

        reformed = Microsimulation(scenario=reform_scenario, dataset=dataset_obj)

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


def generate_two_child_limit_validation(
    output_dir: Optional[Path] = None,
    dataset_path: Optional[Path] = None,
    years: list[int] = None,
) -> pd.DataFrame:
    """Generate two-child limit validation data for SFC comparison.

    This creates data for comparing PolicyEngine estimates with
    Scottish Fiscal Commission projections on the two-child limit.

    Comparison methodology:
    - sim_without_limit: Current law (two-child limit removed from 2026+)
    - sim_with_limit: Counterfactual with limit enforced (child_count=2)

    The cost is calculated as the UC gain from removing the limit.

    Args:
        output_dir: Directory for output CSV file.
        dataset_path: Path to local enhanced_frs h5 file. If None, downloads from HF.
        years: Years to analyze.

    Returns:
        DataFrame with cost and children affected by year.
    """
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    years = years or [2026, 2027, 2028, 2029, 2030]

    print("\nGenerating two-child limit validation data...")

    # Reform dict to impose the two-child limit (for baseline comparison)
    two_child_limit_reform = {
        "gov.dwp.universal_credit.elements.child.limit.child_count": {
            "2026-01-01.2030-12-31": 2
        },
    }

    # Use local dataset if provided
    if dataset_path:
        dataset_obj = UKSingleYearDataset(str(dataset_path))
    else:
        dataset_obj = None

    # Create simulations:
    # - sim_without_limit: Current law (limit removed in PolicyEngine UK)
    # - sim_with_limit: Counterfactual with limit enforced
    sim_without_limit = Microsimulation(dataset=dataset_obj)
    sim_with_limit = Microsimulation(dataset=dataset_obj, reform=two_child_limit_reform)

    # Calculate two-child limit impact
    tcl_calc = TwoChildLimitCalculator(years=years)
    results = tcl_calc.calculate(sim_with_limit, sim_without_limit)

    # Convert to DataFrame
    df = pd.DataFrame(results)

    # Save to CSV
    save_csv(df, output_dir / "two_child_limit_validation.csv")

    print("Two-child limit validation data generated")
    print(f"\n=== Summary ===")
    r2026 = results[0]
    r2029 = results[3]
    print(f"2026-27: PE estimates {r2026['pe_affected_children']:,} children, £{r2026['pe_cost_millions']}m")
    print(f"         SFC estimates {r2026['sfc_affected_children']:,} children, £{r2026['sfc_cost_millions']}m")
    print(f"2029-30: PE estimates {r2029['pe_affected_children']:,} children, £{r2029['pe_cost_millions']}m")
    print(f"         SFC estimates {r2029['sfc_affected_children']:,} children, £{r2029['sfc_cost_millions']}m")

    return df


if __name__ == "__main__":
    # Use local dataset if available
    local_dataset = DEFAULT_DATA_DIR / "enhanced_frs_2023_24.h5"
    dataset_path = local_dataset if local_dataset.exists() else None
    if dataset_path:
        print(f"Using local dataset: {dataset_path}")

    # Generate main dashboard data
    generate_all_data(dataset_path=dataset_path)

    # Generate validation data (two-child limit comparison)
    generate_two_child_limit_validation(dataset_path=dataset_path)
