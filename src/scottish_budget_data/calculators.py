"""Calculators for Scottish Budget dashboard metrics.

Each calculator generates a specific type of output data.
Uses native MicroSeries from PolicyEngine - sim.calculate() returns MicroSeries with weights.
"""

import microdf as mdf
import numpy as np
import pandas as pd
from policyengine_uk import Microsimulation

from .reforms import (
    apply_advanced_rate_freeze_reform,
    apply_basic_rate_uplift_reform,
    apply_combined_reform,
    apply_higher_rate_freeze_reform,
    apply_intermediate_rate_uplift_reform,
    apply_scp_baby_boost_reform,
    apply_scp_inflation_reform,
    apply_top_rate_freeze_reform,
    disable_scp_baby_boost,
    disable_scp_combined,
    disable_scp_inflation,
)

# Map reform IDs to their apply functions
REFORM_APPLY_FNS = {
    "scp_inflation": apply_scp_inflation_reform,
    "scp_baby_boost": apply_scp_baby_boost_reform,
    "income_tax_basic_uplift": apply_basic_rate_uplift_reform,
    "income_tax_intermediate_uplift": apply_intermediate_rate_uplift_reform,
    "higher_rate_freeze": apply_higher_rate_freeze_reform,
    "advanced_rate_freeze": apply_advanced_rate_freeze_reform,
    "top_rate_freeze": apply_top_rate_freeze_reform,
    "combined": apply_combined_reform,
}

# Map reform IDs to baseline modifiers (for counterfactual baselines)
# These are applied to the baseline to create a proper comparison
BASELINE_MODIFIERS = {
    "scp_inflation": disable_scp_inflation,  # Set SCP to £27.15 to measure inflation impact
    "scp_baby_boost": disable_scp_baby_boost,  # Baby boost is in PE baseline, disable to measure impact
    "combined": disable_scp_combined,  # Combined includes both SCP inflation and baby boost
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
        sim.calculate() returns MicroSeries with weights - .sum() is weighted.

        Returns cost in £ millions. Positive = cost to government (income gain for households).
        """
        results = []

        for year in self.years:
            baseline = Microsimulation()
            reformed = Microsimulation()

            # Apply baseline modifier if needed (for counterfactual baselines)
            if reform_id in BASELINE_MODIFIERS:
                BASELINE_MODIFIERS[reform_id](baseline)

            if reform_id in REFORM_APPLY_FNS:
                REFORM_APPLY_FNS[reform_id](reformed)

            is_scotland = get_scotland_household_mask(baseline, year)

            # sim.calculate() returns MicroSeries with weights
            baseline_income = baseline.calculate("household_net_income", year)
            reformed_income = reformed.calculate("household_net_income", year)

            # MicroSeries subtraction preserves weights, .sum() is weighted
            income_change = reformed_income - baseline_income
            household_change = income_change[is_scotland].sum()

            # Negate because household income gain = cost to government
            impact = -household_change / 1e6

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "value": impact,
            })

        return results


class DistributionalImpactCalculator:
    """Calculate distributional impact by income decile.

    Uses fresh simulations per year with proper PolicyEngine Reform classes.
    sim.calculate() returns MicroSeries with weights built in.
    """

    def calculate(
        self,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate distributional impact for a single year (Scotland only).

        Uses native MicroSeries from sim.calculate() - no manual weight handling.
        """
        baseline = Microsimulation()
        reformed = Microsimulation()

        # Apply baseline modifier if needed (for counterfactual baselines)
        if reform_id in BASELINE_MODIFIERS:
            BASELINE_MODIFIERS[reform_id](baseline)

        if reform_id in REFORM_APPLY_FNS:
            REFORM_APPLY_FNS[reform_id](reformed)

        is_scotland = get_scotland_household_mask(baseline, year)

        # sim.calculate() returns MicroSeries with weights
        baseline_income = baseline.calculate("household_net_income", year)
        reformed_income = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)

        # Filter to Scotland - MicroSeries preserves weights when filtered
        baseline_scotland = baseline_income[is_scotland]
        reformed_scotland = reformed_income[is_scotland]
        income_change = reformed_scotland - baseline_scotland
        decile_scotland = income_decile[is_scotland]

        results = []
        decile_labels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]

        for decile in range(1, 11):
            decile_mask = np.array(decile_scotland) == decile
            if not decile_mask.any():
                continue

            # Use native MicroSeries - .mean() is weighted automatically
            avg_change = income_change[decile_mask].mean()
            avg_baseline = baseline_scotland[decile_mask].mean()
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
        overall_avg_change = income_change.mean()
        overall_avg_baseline = baseline_scotland.mean()
        overall_relative_change = (overall_avg_change / overall_avg_baseline) * 100 if overall_avg_baseline > 0 else 0

        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "decile": "All",
            "value": overall_relative_change,
            "absolute_change": overall_avg_change,
        })

        return results


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
        """Calculate poverty and other summary metrics (Scotland only).

        Uses native MicroSeries from sim.calculate() - no manual weight handling.
        """
        is_scotland = get_scotland_person_mask(baseline, year)

        # Get is_child for filtering to children
        is_child = baseline.calculate("is_child", year, map_to="person")
        is_child_scotland = np.array(is_child[is_scotland])

        def add_metric_set(
            results: list[dict],
            metric_prefix: str,
            baseline_ms,  # MicroSeries
            reformed_ms,  # MicroSeries
            child_filter: np.ndarray = None,
        ) -> None:
            """Add baseline, reform, and change metrics for a given measure."""
            if child_filter is not None:
                # Filter to children
                baseline_rate = baseline_ms[child_filter].mean() * 100
                reformed_rate = reformed_ms[child_filter].mean() * 100
            else:
                baseline_rate = baseline_ms.mean() * 100
                reformed_rate = reformed_ms.mean() * 100

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

                # sim.calculate() returns MicroSeries with weights
                baseline_poverty = baseline.calculate(poverty_var, year, map_to="person")
                reformed_poverty = reformed.calculate(poverty_var, year, map_to="person")

                # Filter to Scotland - MicroSeries preserves weights
                baseline_scotland = baseline_poverty[is_scotland]
                reformed_scotland = reformed_poverty[is_scotland]

                # All persons poverty rate
                add_metric_set(results, f"{prefix}poverty_rate", baseline_scotland, reformed_scotland)
                # Child poverty rate
                add_metric_set(results, f"{prefix}child_poverty_rate", baseline_scotland, reformed_scotland, is_child_scotland)

                # Deep poverty (only for absolute poverty measure)
                if deep_poverty_var:
                    baseline_deep = baseline.calculate(deep_poverty_var, year, map_to="person")
                    reformed_deep = reformed.calculate(deep_poverty_var, year, map_to="person")

                    baseline_deep_scotland = baseline_deep[is_scotland]
                    reformed_deep_scotland = reformed_deep[is_scotland]

                    add_metric_set(results, f"{prefix}deep_poverty_rate", baseline_deep_scotland, reformed_deep_scotland)
                    add_metric_set(results, f"{prefix}child_deep_poverty_rate", baseline_deep_scotland, reformed_deep_scotland, is_child_scotland)

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
        """Calculate two-child limit abolition impact for Scotland.

        Uses native MicroSeries from sim.calculate() - no manual weight handling.
        """
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
            # sim.calculate() returns MicroSeries with weights
            region = sim_without_limit.calculate("region", year, map_to="household")
            scotland_mask = np.array(region) == "SCOTLAND"

            uc_without_limit = sim_without_limit.calculate("universal_credit", year, map_to="household")
            uc_with_limit = sim_with_limit.calculate("universal_credit", year, map_to="household")

            # MicroSeries subtraction preserves weights
            uc_gain = uc_without_limit - uc_with_limit
            affected_mask = scotland_mask & (np.array(uc_gain) > 0)

            # .sum() on MicroSeries is weighted
            total_cost = uc_gain[affected_mask].sum()
            total_cost_millions = total_cost / 1e6

            # Count affected benefit units using MicroSeries weights
            affected_benefit_units = uc_gain.weights[affected_mask].sum()

            # Count affected children - need MicroSeries for calculated values
            benunit_children = sim_without_limit.calculate("benunit_count_children", year, map_to="household")
            affected_children_per_hh = np.maximum(np.array(benunit_children) - 2, 0)
            # Use weights from uc_gain MicroSeries (same household weights)
            children_ms = mdf.MicroSeries(affected_children_per_hh, weights=uc_gain.weights.values)
            total_affected_children = children_ms[affected_mask].sum()

            results.append({
                "year": year,
                "pe_affected_children": round(total_affected_children),
                "pe_affected_benefit_units": round(affected_benefit_units),
                "pe_cost_millions": round(total_cost_millions, 1),
                "sfc_affected_children": SFC_DATA[year]["children"],
                "sfc_cost_millions": SFC_DATA[year]["cost"],
            })

        return results


class LocalAuthorityCalculator:
    """Calculate local authority-level impacts.

    Note: This uses external weights from HuggingFace (not simulation weights),
    so we need to explicitly create MicroSeries with those weights.
    """

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        year: int,
        weights: np.ndarray,
        local_authority_df: pd.DataFrame,
    ) -> list[dict]:
        """Calculate average impact for each local authority."""
        # Get values as arrays (we use external LA weights, not simulation weights)
        baseline_income = np.array(baseline.calculate("household_net_income", period=year, map_to="household"))
        reform_income = np.array(reformed.calculate("household_net_income", period=year, map_to="household"))

        results = []

        for idx, (_, row) in enumerate(local_authority_df.iterrows()):
            code = row["code"]
            name = row["name"]

            if idx >= weights.shape[0]:
                continue

            la_weights = weights[idx, :]

            # Use external LA weights with MicroSeries
            baseline_ms = mdf.MicroSeries(baseline_income, weights=la_weights)
            reform_ms = mdf.MicroSeries(reform_income, weights=la_weights)

            avg_baseline = baseline_ms.mean()
            avg_reform = reform_ms.mean()
            avg_gain = avg_reform - avg_baseline
            relative_change = (avg_gain / avg_baseline) * 100 if avg_baseline > 0 else 0

            results.append({
                "reform_id": reform_id,
                "year": year,
                "local_authority_code": code,
                "local_authority_name": name,
                "average_gain": avg_gain,
                "relative_change": relative_change,
            })

        return results
