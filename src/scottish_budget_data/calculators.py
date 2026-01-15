"""Calculators for Scottish Budget dashboard metrics.

Each calculator generates a specific type of output data.
"""

from typing import Optional
import pandas as pd
import numpy as np
from policyengine_uk import Microsimulation


def get_scotland_household_mask(sim: Microsimulation, year: int) -> np.ndarray:
    """Get boolean mask for Scottish households."""
    country = sim.calculate("country", year, map_to="household")
    return np.array(country) == "SCOTLAND"


def get_scotland_person_mask(sim: Microsimulation, year: int) -> np.ndarray:
    """Get boolean mask for Scottish persons."""
    country = sim.calculate("country", year, map_to="person")
    return np.array(country) == "SCOTLAND"


class BudgetaryImpactCalculator:
    """Calculate budgetary impact (cost) of reforms.

    Methodology note:
    This calculates cost as the total change in household net income for
    Scottish households. This approach is appropriate for Scotland-specific
    policies (like SCP Premium for under-ones and Scottish income tax changes) because:

    1. These policies only affect Scottish households directly
    2. The change in household income equals the fiscal cost/revenue impact
    3. Using gov_balance would require apportioning UK-wide aggregates

    For SCP: cost = increased benefit payments to Scottish families
    For income tax: cost = reduced tax revenue from Scottish taxpayers
    """

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
    ) -> list[dict]:
        """Calculate budgetary impact for all years (Scotland only).

        Returns cost in £ millions. Positive = cost to government (income gain for households).
        """
        results = []

        for year in self.years:
            # Filter to Scotland
            is_scotland = get_scotland_household_mask(baseline, year)

            # Keep as MicroSeries (don't convert to numpy) so .sum() uses built-in weights
            baseline_income = baseline.calculate("household_net_income", year)
            reformed_income = reformed.calculate("household_net_income", year)

            # Apply Scotland filter (preserves MicroSeries with weights)
            baseline_income_scotland = baseline_income[is_scotland]
            reformed_income_scotland = reformed_income[is_scotland]

            # Use built-in weighted sum (weights handled automatically by MicroSeries)
            cost = (reformed_income_scotland - baseline_income_scotland).sum()

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "value": cost / 1e6,  # In millions
            })

        return results


class DistributionalImpactCalculator:
    """Calculate distributional impact by income decile."""

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> tuple[list[dict], pd.DataFrame]:
        """Calculate distributional impact for a single year (Scotland only)."""
        # Filter to Scotland
        is_scotland = get_scotland_household_mask(baseline, year)

        baseline_income = np.array(baseline.calculate("household_net_income", year))[is_scotland]
        reformed_income = np.array(reformed.calculate("household_net_income", year))[is_scotland]
        household_weight = np.array(baseline.calculate("household_weight", year))[is_scotland]
        income_decile = np.array(baseline.calculate("household_income_decile", year))[is_scotland]

        df = pd.DataFrame({
            "baseline_income": baseline_income,
            "reformed_income": reformed_income,
            "household_weight": household_weight,
            "income_decile": income_decile,
        })

        df["income_change"] = df["reformed_income"] - df["baseline_income"]
        df["income_decile"] = pd.to_numeric(df["income_decile"], errors="coerce").clip(1, 10).astype(int)

        results = []
        decile_labels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]

        for decile in range(1, 11):
            decile_data = df[df["income_decile"] == decile]
            if len(decile_data) == 0:
                continue

            total_weight = decile_data["household_weight"].sum()
            avg_change = (decile_data["income_change"] * decile_data["household_weight"]).sum() / total_weight
            avg_baseline = (decile_data["baseline_income"] * decile_data["household_weight"]).sum() / total_weight
            relative_change = (avg_change / avg_baseline) * 100 if avg_baseline > 0 else 0

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "decile": decile_labels[decile - 1],
                "value": relative_change,
                "absolute_change": avg_change,
            })

        # Add overall average (All deciles)
        total_weight = df["household_weight"].sum()
        overall_avg_change = (df["income_change"] * df["household_weight"]).sum() / total_weight
        overall_avg_baseline = (df["baseline_income"] * df["household_weight"]).sum() / total_weight
        overall_relative_change = (overall_avg_change / overall_avg_baseline) * 100 if overall_avg_baseline > 0 else 0

        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "decile": "All",
            "value": overall_relative_change,
            "absolute_change": overall_avg_change,
        })

        return results, df


class WinnersLosersCalculator:
    """Calculate winners and losers statistics."""

    def calculate(
        self,
        decile_df: pd.DataFrame,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate winners/losers from decile DataFrame."""
        total_weight = decile_df["household_weight"].sum()

        winners = decile_df[decile_df["income_change"] > 1]["household_weight"].sum()
        losers = decile_df[decile_df["income_change"] < -1]["household_weight"].sum()
        unchanged = total_weight - winners - losers

        return [
            {
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": "winners_pct",
                "value": (winners / total_weight) * 100,
            },
            {
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": "losers_pct",
                "value": (losers / total_weight) * 100,
            },
            {
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": "unchanged_pct",
                "value": (unchanged / total_weight) * 100,
            },
        ]


class MetricsCalculator:
    """Calculate summary metrics including poverty impacts."""

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate poverty and other summary metrics (Scotland only)."""
        from microdf import MicroSeries

        results = []

        # Filter to Scotland
        is_scotland = get_scotland_person_mask(baseline, year)
        person_weight = baseline.calculate("person_weight", year, map_to="person").values[is_scotland]
        is_child = baseline.calculate("is_child", year, map_to="person").values[is_scotland]

        # Calculate poverty for both BHC and AHC
        for housing_cost in ["bhc", "ahc"]:
            poverty_var = f"in_poverty_{housing_cost}"
            prefix = f"{housing_cost}_"

            baseline_poverty = baseline.calculate(poverty_var, year, map_to="person").values[is_scotland]
            reformed_poverty = reformed.calculate(poverty_var, year, map_to="person").values[is_scotland]

            # Overall poverty - use MicroSeries.mean() for proper weighted average
            baseline_ms = MicroSeries(baseline_poverty, weights=person_weight)
            reformed_ms = MicroSeries(reformed_poverty, weights=person_weight)
            baseline_rate = baseline_ms.mean() * 100
            reformed_rate = reformed_ms.mean() * 100

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}poverty_rate_baseline",
                "value": baseline_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}poverty_rate_reform",
                "value": reformed_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}poverty_rate_change",
                "value": reformed_rate - baseline_rate,
            })

            # Child poverty - use MicroSeries.mean() with child weights
            child_weights = person_weight * is_child
            child_baseline_ms = MicroSeries(baseline_poverty, weights=child_weights)
            child_reformed_ms = MicroSeries(reformed_poverty, weights=child_weights)
            child_baseline_rate = child_baseline_ms.mean() * 100
            child_reformed_rate = child_reformed_ms.mean() * 100

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}child_poverty_rate_baseline",
                "value": child_baseline_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}child_poverty_rate_reform",
                "value": child_reformed_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}child_poverty_rate_change",
                "value": child_reformed_rate - child_baseline_rate,
            })

            # Deep poverty (below 50% of median income)
            deep_poverty_var = f"in_deep_poverty_{housing_cost}"
            baseline_deep = baseline.calculate(deep_poverty_var, year, map_to="person").values[is_scotland]
            reformed_deep = reformed.calculate(deep_poverty_var, year, map_to="person").values[is_scotland]

            # Overall deep poverty - use MicroSeries.mean()
            deep_baseline_ms = MicroSeries(baseline_deep, weights=person_weight)
            deep_reformed_ms = MicroSeries(reformed_deep, weights=person_weight)
            deep_baseline_rate = deep_baseline_ms.mean() * 100
            deep_reformed_rate = deep_reformed_ms.mean() * 100

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}deep_poverty_rate_baseline",
                "value": deep_baseline_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}deep_poverty_rate_reform",
                "value": deep_reformed_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}deep_poverty_rate_change",
                "value": deep_reformed_rate - deep_baseline_rate,
            })

            # Child deep poverty - use MicroSeries.mean() with child weights
            child_deep_baseline_ms = MicroSeries(baseline_deep, weights=child_weights)
            child_deep_reformed_ms = MicroSeries(reformed_deep, weights=child_weights)
            child_deep_baseline_rate = child_deep_baseline_ms.mean() * 100
            child_deep_reformed_rate = child_deep_reformed_ms.mean() * 100

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}child_deep_poverty_rate_baseline",
                "value": child_deep_baseline_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}child_deep_poverty_rate_reform",
                "value": child_deep_reformed_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{prefix}child_deep_poverty_rate_change",
                "value": child_deep_reformed_rate - child_deep_baseline_rate,
            })

        return results


class ConstituencyCalculator:
    """Calculate constituency-level impacts."""

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        year: int,
        weights: np.ndarray,
        constituency_df: pd.DataFrame,
    ) -> list[dict]:
        """Calculate average impact for each constituency.

        Args:
            weights: Array of shape (num_constituencies, num_households)
            constituency_df: DataFrame with 'code' and 'name' columns.
                The index should correspond to the row indices in weights.
        """
        from microdf import MicroSeries

        baseline_income = baseline.calculate(
            "household_net_income", period=year, map_to="household"
        ).values
        reform_income = reformed.calculate(
            "household_net_income", period=year, map_to="household"
        ).values

        results = []

        # Iterate over constituency_df using positional index
        for idx, (_, row) in enumerate(constituency_df.iterrows()):
            code = row["code"]
            name = row["name"]

            # Get constituency weights (row idx of weights matrix)
            # weights shape is (num_constituencies, num_households)
            if idx >= weights.shape[0]:
                continue

            const_weights = weights[idx, :]

            # Calculate weighted average using MicroSeries
            baseline_ms = MicroSeries(baseline_income, weights=const_weights)
            reform_ms = MicroSeries(reform_income, weights=const_weights)

            # Use .mean() which properly calculates weighted_sum / sum_of_weights
            avg_baseline = baseline_ms.mean()
            avg_reform = reform_ms.mean()
            avg_gain = avg_reform - avg_baseline
            relative_change = (avg_gain / avg_baseline) * 100 if avg_baseline > 0 else 0

            results.append({
                "reform_id": reform_id,
                "year": year,
                "constituency_code": code,
                "constituency_name": name,
                "average_gain": avg_gain,
                "relative_change": relative_change,
            })

        return results
