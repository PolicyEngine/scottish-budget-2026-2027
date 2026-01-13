"""Calculators for Scottish Budget dashboard metrics.

Each calculator generates a specific type of output data.
"""

from typing import Optional
import pandas as pd
import numpy as np
from policyengine_uk import Microsimulation


class BudgetaryImpactCalculator:
    """Calculate budgetary impact (cost) of reforms."""

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
    ) -> list[dict]:
        """Calculate budgetary impact for all years."""
        results = []

        for year in self.years:
            baseline_income = baseline.calculate("household_net_income", year)
            reformed_income = reformed.calculate("household_net_income", year)
            household_weight = baseline.calculate("household_weight", year)

            # Cost is increase in household income (government spending)
            cost = ((reformed_income - baseline_income) * household_weight).sum()

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "value": cost / 1e9,  # In billions
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
        """Calculate distributional impact for a single year."""
        baseline_income = baseline.calculate("household_net_income", year)
        reformed_income = reformed.calculate("household_net_income", year)
        household_weight = baseline.calculate("household_weight", year)
        income_decile = baseline.calculate("household_income_decile", year)

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
        """Calculate poverty and other summary metrics."""
        results = []

        # Overall poverty
        baseline_poverty = baseline.calculate("in_poverty", year, map_to="person").values
        reformed_poverty = reformed.calculate("in_poverty", year, map_to="person").values
        person_weight = baseline.calculate("person_weight", year, map_to="person").values

        baseline_rate = (baseline_poverty * person_weight).sum() / person_weight.sum() * 100
        reformed_rate = (reformed_poverty * person_weight).sum() / person_weight.sum() * 100

        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "metric": "poverty_rate_baseline",
            "value": baseline_rate,
        })
        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "metric": "poverty_rate_reform",
            "value": reformed_rate,
        })
        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "metric": "poverty_rate_change",
            "value": reformed_rate - baseline_rate,
        })

        # Child poverty
        is_child = baseline.calculate("is_child", year, map_to="person").values

        child_baseline_rate = (baseline_poverty * person_weight * is_child).sum() / (person_weight * is_child).sum() * 100
        child_reformed_rate = (reformed_poverty * person_weight * is_child).sum() / (person_weight * is_child).sum() * 100

        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "metric": "child_poverty_rate_baseline",
            "value": child_baseline_rate,
        })
        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "metric": "child_poverty_rate_reform",
            "value": child_reformed_rate,
        })
        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "metric": "child_poverty_rate_change",
            "value": child_reformed_rate - child_baseline_rate,
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

            avg_gain = (reform_ms.sum() - baseline_ms.sum()) / baseline_ms.count()
            avg_baseline = baseline_ms.sum() / baseline_ms.count()
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
