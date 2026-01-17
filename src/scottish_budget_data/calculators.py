"""Calculators for Scottish Budget dashboard metrics.

Each calculator generates a specific type of output data.
"""

import numpy as np
import pandas as pd
from microdf import MicroSeries
from policyengine_uk import Microsimulation

from .reforms import (
    apply_combined_reform,
    apply_income_tax_threshold_reform,
    apply_scp_baby_boost_reform,
)

# Map reform IDs to their apply functions
REFORM_APPLY_FNS = {
    "scp_baby_boost": apply_scp_baby_boost_reform,
    "income_tax_threshold_uplift": apply_income_tax_threshold_reform,
    "combined": apply_combined_reform,
}


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

    Uses fresh simulations per year with proper PolicyEngine Reform classes.
    """

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(self, reform_id: str, reform_name: str) -> list[dict]:
        """Calculate budgetary impact for all years (Scotland only).

        Uses fresh simulations per year with proper Reform classes.

        Returns cost in £ millions. Positive = cost to government (income gain for households).
        """
        results = []

        for year in self.years:
            baseline = Microsimulation()
            reformed = Microsimulation()

            if reform_id in REFORM_APPLY_FNS:
                REFORM_APPLY_FNS[reform_id](reformed)

            is_scotland = get_scotland_household_mask(baseline, year)

            baseline_income = baseline.calculate("household_net_income", year)
            reformed_income = reformed.calculate("household_net_income", year)

            cost = (reformed_income[is_scotland] - baseline_income[is_scotland]).sum()

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "value": cost / 1e6,
            })

        return results


class DistributionalImpactCalculator:
    """Calculate distributional impact by income decile.

    Uses fresh simulations per year with proper PolicyEngine Reform classes.
    """

    def calculate(
        self,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> tuple[list[dict], pd.DataFrame]:
        """Calculate distributional impact for a single year (Scotland only).

        Uses fresh simulations with proper Reform classes.
        """
        baseline = Microsimulation()
        reformed = Microsimulation()

        if reform_id in REFORM_APPLY_FNS:
            REFORM_APPLY_FNS[reform_id](reformed)

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

            weights = decile_data["household_weight"].values
            avg_change = MicroSeries(decile_data["income_change"].values, weights=weights).mean()
            avg_baseline = MicroSeries(decile_data["baseline_income"].values, weights=weights).mean()
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
        overall_weights = df["household_weight"].values
        overall_avg_change = MicroSeries(df["income_change"].values, weights=overall_weights).mean()
        overall_avg_baseline = MicroSeries(df["baseline_income"].values, weights=overall_weights).mean()
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
        # Create MicroSeries with household weights for proper weighted sums
        weights = decile_df["household_weight"].values
        ones = np.ones(len(decile_df))
        total_weight = MicroSeries(ones, weights=weights).sum()

        winner_mask = decile_df["income_change"] > 1
        loser_mask = decile_df["income_change"] < -1

        winners = MicroSeries(ones[winner_mask], weights=weights[winner_mask]).sum()
        losers = MicroSeries(ones[loser_mask], weights=weights[loser_mask]).sum()
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

                # Variable names in PolicyEngine UK
                if poverty_type == "absolute":
                    poverty_var = f"in_poverty_{housing_cost}"
                    deep_poverty_var = f"in_deep_poverty_{housing_cost}"
                else:
                    poverty_var = f"in_relative_poverty_{housing_cost}"
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
    """Calculate two-child limit impact for Scotland (validation comparison)."""

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(
        self,
        sim_with_limit: Microsimulation,
        sim_without_limit: Microsimulation,
    ) -> list[dict]:
        """Calculate two-child limit abolition impact for Scotland."""
        # SFC estimates for comparison
        SFC_DATA = {
            2026: {"children": 43000, "cost": 155},
            2027: {"children": 46000, "cost": 170},
            2028: {"children": 48000, "cost": 182},
            2029: {"children": 50000, "cost": 198},
            2030: {"children": 52000, "cost": 205},
        }

        results = []

        for year in self.years:
            region = sim_without_limit.calculate("region", year, map_to="household").values
            scotland_mask = region == "SCOTLAND"
            hh_weight = sim_without_limit.calculate("household_weight", year, map_to="household").values

            uc_without_limit = sim_without_limit.calculate("universal_credit", year, map_to="household").values
            uc_with_limit = sim_with_limit.calculate("universal_credit", year, map_to="household").values
            uc_gain = uc_without_limit - uc_with_limit

            affected_mask = scotland_mask & (uc_gain > 0)
            affected_weights = hh_weight[affected_mask]
            total_cost = MicroSeries(uc_gain[affected_mask], weights=affected_weights).sum()
            total_cost_millions = total_cost / 1e6
            affected_benefit_units = MicroSeries(np.ones(affected_weights.shape), weights=affected_weights).sum()

            benunit_children = sim_without_limit.calculate(
                "benunit_count_children", year, map_to="household"
            ).values
            affected_children_per_hh = np.maximum(benunit_children - 2, 0)
            total_affected_children = MicroSeries(
                affected_children_per_hh[affected_mask], weights=affected_weights
            ).sum()

            results.append({
                "year": year,
                "pe_affected_children": round(total_affected_children),
                "pe_affected_benefit_units": round(affected_benefit_units),
                "pe_cost_millions": round(total_cost_millions, 1),
                "sfc_affected_children": SFC_DATA[year]["children"],
                "sfc_cost_millions": SFC_DATA[year]["cost"],
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
        """Calculate average impact for each constituency."""
        baseline_income = baseline.calculate(
            "household_net_income", period=year, map_to="household"
        ).values
        reform_income = reformed.calculate(
            "household_net_income", period=year, map_to="household"
        ).values

        results = []

        for idx, (_, row) in enumerate(constituency_df.iterrows()):
            code = row["code"]
            name = row["name"]

            if idx >= weights.shape[0]:
                continue

            const_weights = weights[idx, :]

            baseline_ms = MicroSeries(baseline_income, weights=const_weights)
            reform_ms = MicroSeries(reform_income, weights=const_weights)

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
