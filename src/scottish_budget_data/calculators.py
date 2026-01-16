"""Calculators for Scottish Budget dashboard metrics.

Each calculator generates a specific type of output data.
"""

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

        is_scotland = get_scotland_person_mask(baseline, year)
        person_weight = baseline.calculate("person_weight", year, map_to="person").values[is_scotland]
        is_child = baseline.calculate("is_child", year, map_to="person").values[is_scotland]
        child_weights = person_weight * is_child

        def add_metric_set(
            results: list[dict],
            metric_prefix: str,
            baseline_values: np.ndarray,
            reformed_values: np.ndarray,
            weights: np.ndarray,
        ) -> None:
            """Add baseline, reform, and change metrics for a given measure."""
            baseline_rate = MicroSeries(baseline_values, weights=weights).mean() * 100
            reformed_rate = MicroSeries(reformed_values, weights=weights).mean() * 100

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{metric_prefix}_baseline",
                "value": baseline_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{metric_prefix}_reform",
                "value": reformed_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{metric_prefix}_change",
                "value": reformed_rate - baseline_rate,
            })

        results = []

        for housing_cost in ["bhc", "ahc"]:
            for poverty_type in ["absolute", "relative"]:
                # Construct metric prefix: e.g., "abs_bhc_" or "rel_ahc_"
                prefix = f"{poverty_type[:3]}_{housing_cost}_"

                # Variable names in PolicyEngine UK (confusingly named):
                # - in_poverty_bhc / in_poverty_ahc = absolute poverty (below 60% of 2010-11 median)
                # - in_relative_poverty_bhc / in_relative_poverty_ahc = relative poverty (below 60% of current median)
                # - in_deep_poverty_bhc / in_deep_poverty_ahc = deep absolute poverty
                if poverty_type == "absolute":
                    poverty_var = f"in_poverty_{housing_cost}"
                    deep_poverty_var = f"in_deep_poverty_{housing_cost}"
                else:
                    poverty_var = f"in_relative_poverty_{housing_cost}"
                    # No deep relative poverty variable exists, skip it
                    deep_poverty_var = None

                # Regular poverty
                baseline_poverty = baseline.calculate(poverty_var, year, map_to="person").values[is_scotland]
                reformed_poverty = reformed.calculate(poverty_var, year, map_to="person").values[is_scotland]

                add_metric_set(results, f"{prefix}poverty_rate", baseline_poverty, reformed_poverty, person_weight)
                add_metric_set(results, f"{prefix}child_poverty_rate", baseline_poverty, reformed_poverty, child_weights)

                # Deep poverty (only for absolute poverty measure)
                if deep_poverty_var:
                    baseline_deep = baseline.calculate(deep_poverty_var, year, map_to="person").values[is_scotland]
                    reformed_deep = reformed.calculate(deep_poverty_var, year, map_to="person").values[is_scotland]

                    add_metric_set(results, f"{prefix}deep_poverty_rate", baseline_deep, reformed_deep, person_weight)
                    add_metric_set(results, f"{prefix}child_deep_poverty_rate", baseline_deep, reformed_deep, child_weights)

        return results


class TwoChildLimitCalculator:
    """Calculate two-child limit impact for Scotland (validation comparison).

    Computes cost and number of children affected by abolishing the two-child limit.
    Used for comparison with Scottish Fiscal Commission estimates.
    """

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
    ) -> list[dict]:
        """Calculate two-child limit abolition impact for Scotland.

        Returns cost in £ millions and number of children affected in thousands.
        """
        results = []

        for year in self.years:
            # Filter to Scotland
            is_scotland_hh = get_scotland_household_mask(baseline, year)
            is_scotland_person = get_scotland_person_mask(baseline, year)

            # Calculate cost (change in household income = benefit increase)
            baseline_income = baseline.calculate("household_net_income", year)
            reformed_income = reformed.calculate("household_net_income", year)

            baseline_scotland = baseline_income[is_scotland_hh]
            reformed_scotland = reformed_income[is_scotland_hh]

            cost = (reformed_scotland - baseline_scotland).sum()

            # Count children affected (children in households that gain income)
            # A child is affected if they're in a household with 3+ children
            # that receives qualifying benefits
            is_child = baseline.calculate("is_child", year, map_to="person").values[is_scotland_person]
            person_weights = baseline.calculate("person_weight", year, map_to="person").values[is_scotland_person]

            # Map household income gain to persons
            hh_gain = np.array(reformed_income) - np.array(baseline_income)
            person_gain = baseline.map_result(hh_gain, "household", "person")[is_scotland_person]

            # Children affected are those with household income gain > £1
            children_affected_mask = (is_child > 0) & (person_gain > 1)
            children_affected = np.sum(person_weights * children_affected_mask)

            results.append({
                "year": year,
                "cost_millions": cost / 1e6,
                "children_affected_thousands": children_affected / 1e3,
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
