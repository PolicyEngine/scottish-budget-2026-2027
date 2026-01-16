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

    IMPORTANT: Creates fresh simulations for each year to avoid PolicyEngine
    caching issues that cause cross-year contamination.
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

        Note: The baseline/reformed parameters are used to get the scenario
        configuration, but fresh simulations are created per-year to avoid
        caching issues.

        Returns cost in £ millions. Positive = cost to government (income gain for households).
        """
        from .reforms import calculate_scp_baby_boost_cost

        results = []

        for year in self.years:
            if reform_id == "scp_baby_boost":
                # SCP baby boost: direct calculation (no simulation modification needed)
                cost = self._calculate_scp_cost_for_year(year)
            elif reform_id == "combined":
                # Combined = SCP baby boost + income tax threshold uplift
                scp_cost = self._calculate_scp_cost_for_year(year)
                tax_cost = self._calculate_income_tax_cost_for_year(year)
                cost = scp_cost + tax_cost
            elif reform_id == "income_tax_threshold_uplift":
                # Income tax: fresh simulations per year
                cost = self._calculate_income_tax_cost_for_year(year)
            else:
                # Generic reform: fresh simulations per year
                cost = self._calculate_generic_cost_for_year(reformed, year)

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "value": cost / 1e6,  # In millions
            })

        return results

    def _calculate_scp_cost_for_year(self, year: int) -> float:
        """Calculate SCP baby boost cost for a single year."""
        from .reforms import calculate_scp_baby_boost_cost

        # Fresh simulation for this year
        sim = Microsimulation()
        return calculate_scp_baby_boost_cost(sim, year)

    def _calculate_income_tax_cost_for_year(self, year: int) -> float:
        """Calculate income tax threshold uplift cost for a single year."""
        from policyengine_uk import Microsimulation
        from policyengine_uk.utils.scenario import Scenario
        from .reforms import _income_tax_modifier

        # Fresh simulations for this year
        baseline = Microsimulation()
        reformed = Microsimulation(
            scenario=Scenario(simulation_modifier=_income_tax_modifier)
        )

        is_scotland = get_scotland_household_mask(baseline, year)

        baseline_income = baseline.calculate("household_net_income", year)
        reformed_income = reformed.calculate("household_net_income", year)

        return (reformed_income[is_scotland] - baseline_income[is_scotland]).sum()

    def _calculate_generic_cost_for_year(
        self, reformed_template: Microsimulation, year: int
    ) -> float:
        """Calculate cost for a generic reform using fresh simulations."""
        # Fresh baseline
        baseline = Microsimulation()

        # Fresh reformed with same scenario as template
        reformed = Microsimulation(scenario=reformed_template.scenario)

        is_scotland = get_scotland_household_mask(baseline, year)

        baseline_income = baseline.calculate("household_net_income", year)
        reformed_income = reformed.calculate("household_net_income", year)

        return (reformed_income[is_scotland] - baseline_income[is_scotland]).sum()


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

    Based on methodology from PolicyEngine/scottish-budget-dashboard.
    """

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(
        self,
        sim_with_limit: Microsimulation,
        sim_without_limit: Microsimulation,
    ) -> list[dict]:
        """Calculate two-child limit abolition impact for Scotland.

        Args:
            sim_with_limit: Simulation with two-child limit in place (child_count=2)
            sim_without_limit: Simulation without limit (child_count=inf, current law)

        Returns:
            List of dicts with year, cost_millions, children_affected_thousands,
            and SFC comparison figures.
        """
        # SFC estimates for comparison (from Scottish Fiscal Commission)
        SFC_DATA = {
            2026: {"children": 43000, "cost": 155},
            2027: {"children": 46000, "cost": 170},
            2028: {"children": 48000, "cost": 182},
            2029: {"children": 50000, "cost": 198},
            2030: {"children": 52000, "cost": 205},
        }

        results = []

        for year in self.years:
            # Get Scotland mask using region variable
            region = sim_without_limit.calculate("region", year, map_to="household").values
            scotland_mask = region == "SCOTLAND"

            # Get weights
            hh_weight = sim_without_limit.calculate("household_weight", year, map_to="household").values

            # Get UC entitlement under both scenarios
            uc_without_limit = sim_without_limit.calculate("universal_credit", year, map_to="household").values
            uc_with_limit = sim_with_limit.calculate("universal_credit", year, map_to="household").values

            # Calculate the gain from removing limit
            uc_gain = uc_without_limit - uc_with_limit

            # Affected households are Scottish households with a gain
            affected_mask = scotland_mask & (uc_gain > 0)

            # Total cost (sum of gains)
            total_cost = (uc_gain[affected_mask] * hh_weight[affected_mask]).sum()
            total_cost_millions = total_cost / 1e6

            # Count affected benefit units
            affected_benefit_units = hh_weight[affected_mask].sum()

            # Count affected children (children beyond the first 2 in affected HHs)
            benunit_children = sim_without_limit.calculate(
                "benunit_count_children", year, map_to="household"
            ).values
            affected_children_per_hh = np.maximum(benunit_children - 2, 0)
            total_affected_children = (
                affected_children_per_hh[affected_mask] * hh_weight[affected_mask]
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
