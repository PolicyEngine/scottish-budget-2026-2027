"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.

All reforms use the simulation_modifier approach which applies structural
reforms directly via policyengine-uk's reform system. This provides better
integration with the tax-benefit system than parameter_changes alone.

The module also exports single-year helper functions for use in personal
calculator APIs (modal_app.py, api.py).
"""

from dataclasses import dataclass, field
from typing import Callable, Optional
import numpy as np
from policyengine_core.model_api import *


# Constants for SCP Premium for under-ones
WEEKS_IN_YEAR = 52
SCP_STANDARD_RATE = 27.15  # £/week (current rate from Apr 2025)
SCP_BABY_RATE = 40.00  # £/week for babies under 1 (from Scottish Budget 2026)
SCP_BABY_BOOST = SCP_BABY_RATE - SCP_STANDARD_RATE  # Extra £12.85/week


def create_scp_baby_boost_reform(tax_benefit_system):
    """Create a reform that adds the SCP baby boost for under-ones.

    This uses PolicyEngine's proper reform mechanism to modify the
    scottish_child_payment formula, avoiding issues with set_input caching.
    """
    from policyengine_uk.variables.gov.social_security_scotland.scottish_child_payment import (
        scottish_child_payment as original_scp,
    )

    class scottish_child_payment(original_scp):
        def formula(benunit, period, parameters):
            # Get the original SCP calculation
            original_amount = original_scp.formula(benunit, period, parameters)

            # Check if in Scotland and receiving SCP
            in_scotland = (
                benunit.household("country", period).decode_to_str() == "SCOTLAND"
            )
            receives_scp = original_amount > 0

            # Count babies (under 1 year old) in the benefit unit
            age = benunit.members("age", period)
            is_baby = age < 1
            babies_in_benunit = benunit.sum(is_baby)

            # Calculate baby boost: £12.85/week extra per baby × 52 weeks
            baby_boost_annual = babies_in_benunit * SCP_BABY_BOOST * WEEKS_IN_YEAR

            # Only add boost for Scottish families already receiving SCP
            boost = where(in_scotland & receives_scp, baby_boost_annual, 0)

            return original_amount + boost

    class reform(Reform):
        def apply(self):
            self.update_variable(scottish_child_payment)

    return reform


# Constants for income tax threshold uplift
# The announced increases for 2026-27 (absolute amounts above baseline)
# Basic: £15,398 → £16,537 = +£1,139
# Intermediate: £27,492 → £29,527 = +£2,035
# These translate to threshold-above-PA increases of:
INCOME_TAX_BASIC_INCREASE = 1_069  # £3,966 - £2,897 (2026 baseline)
INCOME_TAX_INTERMEDIATE_INCREASE = 1_665  # £16,956 - £15,291 (2026 baseline)

# Default years for microsim analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


@dataclass
class Reform:
    """A policy reform definition."""

    id: str
    name: str
    description: str
    parameter_changes: dict = field(default_factory=dict)
    baseline_parameter_changes: Optional[dict] = None
    simulation_modifier: Optional[Callable] = None
    baseline_simulation_modifier: Optional[Callable] = None
    applied_before_data_load: bool = False  # Set True for params that trigger structural reforms

    def to_scenario(self):
        """Convert to PolicyEngine Scenario."""
        from policyengine_uk.utils.scenario import Scenario

        if self.simulation_modifier and self.parameter_changes:
            return Scenario(
                simulation_modifier=self.simulation_modifier,
                parameter_changes=self.parameter_changes,
                applied_before_data_load=self.applied_before_data_load,
            )
        elif self.simulation_modifier:
            return Scenario(
                simulation_modifier=self.simulation_modifier,
                applied_before_data_load=self.applied_before_data_load,
            )
        elif self.parameter_changes:
            return Scenario(
                parameter_changes=self.parameter_changes,
                applied_before_data_load=self.applied_before_data_load,
            )
        return None

    def to_baseline_scenario(self):
        """Convert baseline changes to PolicyEngine Scenario."""
        from policyengine_uk.utils.scenario import Scenario

        if self.baseline_simulation_modifier and self.baseline_parameter_changes:
            return Scenario(
                simulation_modifier=self.baseline_simulation_modifier,
                parameter_changes=self.baseline_parameter_changes,
            )
        elif self.baseline_simulation_modifier:
            return Scenario(simulation_modifier=self.baseline_simulation_modifier)
        elif self.baseline_parameter_changes:
            return Scenario(parameter_changes=self.baseline_parameter_changes)
        return None


def apply_income_tax_threshold_uplift_for_year(sim, year: int) -> None:
    """Apply Scottish income tax threshold uplift for a single year.

    From Scottish Budget 2026-27:
    - Basic rate (20%) threshold: £15,398 -> £16,537 (+£1,139 absolute)
    - Intermediate rate (21%) threshold: £27,492 -> £29,527 (+£2,035 absolute)

    Args:
        sim: PolicyEngine simulation object
        year: The year to apply the uplift for
    """
    params = sim.tax_benefit_system.parameters
    scotland_rates = params.gov.hmrc.income_tax.rates.scotland.rates

    # Get baseline thresholds
    baseline_basic = scotland_rates.brackets[1].threshold(f"{year}-01-01")
    baseline_intermediate = scotland_rates.brackets[2].threshold(f"{year}-01-01")

    # Apply the announced increases
    scotland_rates.brackets[1].threshold.update(
        period=f"{year}-01-01",
        value=baseline_basic + INCOME_TAX_BASIC_INCREASE,
    )
    scotland_rates.brackets[2].threshold.update(
        period=f"{year}-01-01",
        value=baseline_intermediate + INCOME_TAX_INTERMEDIATE_INCREASE,
    )


def apply_scp_baby_boost_for_year(sim, year: int) -> None:
    """Apply SCP Premium for under-ones for a single year.

    NOTE: This uses set_input which has caching issues in multi-year scenarios.
    For microsimulation, use calculate_scp_baby_boost_cost() instead.

    Args:
        sim: PolicyEngine simulation object
        year: The year to apply the boost for
    """
    # Get current SCP values (already filters for Scotland + qualifying benefits)
    current_scp = sim.calculate("scottish_child_payment", year)

    # Get person-level age to count babies
    age = sim.calculate("age", year, map_to="person")
    is_baby = np.array(age) < 1

    # Map babies to benefit units using PolicyEngine's mapping
    babies_per_benunit = sim.map_result(is_baby.astype(float), "person", "benunit")

    # Calculate baby boost (£12.85/week extra × 52 weeks per baby)
    annual_boost = np.array(babies_per_benunit) * SCP_BABY_BOOST * WEEKS_IN_YEAR

    # Only apply boost to families already receiving SCP
    already_receives_scp = np.array(current_scp) > 0
    baby_boost = np.where(already_receives_scp, annual_boost, 0)

    # Add boost to current SCP
    new_scp = np.array(current_scp) + baby_boost
    sim.set_input("scottish_child_payment", year, new_scp)


def calculate_scp_baby_boost_cost(sim, year: int) -> float:
    """Calculate the cost of SCP baby boost for a given year (Scotland only).

    This calculates the boost directly without using set_input, avoiding
    caching issues that occur in multi-year simulations.

    Args:
        sim: PolicyEngine Microsimulation object
        year: Year to calculate for

    Returns:
        Total cost in £ (positive = cost to government)
    """
    # Filter to Scotland
    region = sim.calculate("region", year, map_to="household").values
    scotland_mask = region == "SCOTLAND"
    hh_weight = sim.calculate("household_weight", year).values

    # Get SCP-receiving benefit units
    scp = sim.calculate("scottish_child_payment", year, map_to="benunit").values
    receives_scp = scp > 0

    # Count babies (under 1) in each benefit unit
    age = sim.calculate("age", year, map_to="person").values
    is_baby = age < 1
    babies_per_benunit = sim.map_result(is_baby.astype(float), "person", "benunit")

    # Calculate annual boost: only for SCP recipients
    baby_boost_annual = np.where(receives_scp, babies_per_benunit * SCP_BABY_BOOST * WEEKS_IN_YEAR, 0)

    # Map to household level and sum for Scotland
    baby_boost_hh = sim.map_result(baby_boost_annual, "benunit", "household")
    total_cost = (baby_boost_hh * hh_weight)[scotland_mask].sum()

    return total_cost


def _income_tax_modifier(sim):
    """Apply income tax threshold uplift via simulation_modifier."""
    for year in DEFAULT_YEARS:
        apply_income_tax_threshold_uplift_for_year(sim, year)
    return sim


def _scp_baby_boost_modifier(sim):
    """Apply SCP baby boost reform only.

    Uses apply_scp_baby_boost_for_year to add the baby premium
    (£40/week vs £27.15/week standard) for children under 1.
    """
    for year in DEFAULT_YEARS:
        apply_scp_baby_boost_for_year(sim, year)
    return sim


def _combined_modifier(sim):
    """Apply both SCP baby boost and income tax threshold uplift.

    Order matters: income tax params must be set BEFORE SCP calculations,
    because SCP modifier calls sim.calculate() which triggers the full
    simulation with whatever parameters are currently set.
    """
    _income_tax_modifier(sim)  # Set params first (no calculations)
    _scp_baby_boost_modifier(sim)  # Then calculate with new params
    return sim


def _abolish_two_child_limit_modifier(sim):
    """Abolish the two-child limit on UC/Child Tax Credit child elements.

    The two-child limit restricts benefit entitlement for the third+ child
    in Universal Credit and Child Tax Credit. Abolishing it would increase
    benefits for families with 3+ children.

    Note: In PolicyEngine UK, the two-child limit is already abolished
    from 2026 onwards in baseline. This modifier explicitly sets child_count
    to infinity for all years to measure the full impact.
    """
    import numpy as np
    params = sim.tax_benefit_system.parameters

    # Abolish UC two-child limit by setting child_count to infinity
    uc_limit = params.gov.dwp.universal_credit.elements.child.limit
    for year in DEFAULT_YEARS:
        uc_limit.child_count.update(period=f"{year}-01-01", value=np.inf)

    return sim


def _impose_two_child_limit_modifier(sim):
    """Impose the two-child limit (for baseline comparison).

    Sets child_count to 2 for all years to model the pre-abolition scenario.
    """
    params = sim.tax_benefit_system.parameters

    uc_limit = params.gov.dwp.universal_credit.elements.child.limit
    for year in DEFAULT_YEARS:
        uc_limit.child_count.update(period=f"{year}-01-01", value=2)

    return sim


def get_scottish_budget_reforms() -> list[Reform]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns a list of Reform objects:
    - SCP baby boost: Uses simulation_modifier to directly apply PE-UK's structural reform
    - Income tax: Uses simulation_modifier to directly modify thresholds
    - Combined: Uses simulation_modifier for both reforms

    Returns:
        List of Reform objects for analysis.
    """
    reforms = []

    # Combined reform (both policies together) - listed first
    # Uses simulation_modifier to apply BOTH reforms after data load
    # (Directly applies SCP structural reform + income tax threshold changes)
    reforms.append(
        Reform(
            id="combined",
            name="Both policies combined",
            description=(
                "Full Scottish Budget 2026-27 package: SCP Premium for under-ones (£40/week) "
                "and income tax threshold uplift (7.4%) applied together."
            ),
            simulation_modifier=_combined_modifier,
        )
    )

    # SCP Premium for under-ones (£40/week for babies under 1)
    # Uses simulation_modifier to directly apply the structural reform from policyengine-uk
    reforms.append(
        Reform(
            id="scp_baby_boost",
            name="SCP Premium for under-ones (£40/week)",
            description=(
                "New SCP Premium for under-ones: £40/week for babies under 1 "
                "(up from £27.15/week). Announced in Scottish Budget 2026-27."
            ),
            simulation_modifier=_scp_baby_boost_modifier,
        )
    )

    # Scottish income tax threshold uplift (7.4%)
    # Uses simulation_modifier to directly modify Scottish rate thresholds
    reforms.append(
        Reform(
            id="income_tax_threshold_uplift",
            name="Income tax threshold uplift (7.4%)",
            description=(
                "Scottish basic and intermediate rate thresholds increased by 7.4%. "
                "Basic rate starts at £16,537, intermediate at £29,527."
            ),
            simulation_modifier=_income_tax_modifier,
        )
    )

    return reforms


def get_two_child_limit_reform() -> Reform:
    """Get the two-child limit abolition reform for validation analysis.

    This is used to compare PolicyEngine estimates with Scottish Fiscal Commission
    projections, not part of the Scottish Budget 2026-27 itself.

    Comparison:
    - Baseline: Two-child limit imposed (child_count = 2)
    - Reform: Two-child limit abolished (child_count = inf)

    This measures the cost of abolishing the two-child limit.

    Returns:
        Reform object for abolishing the two-child limit.
    """
    return Reform(
        id="abolish_two_child_limit",
        name="Abolish two-child limit",
        description=(
            "Remove the two-child limit on UC/CTC child elements. "
            "For validation comparison with Scottish Fiscal Commission estimates."
        ),
        baseline_simulation_modifier=_impose_two_child_limit_modifier,
        simulation_modifier=_abolish_two_child_limit_modifier,
    )


# Policy metadata for dashboard
POLICIES = [
    {
        "id": "combined",
        "name": "Both policies combined",
        "description": "Full Scottish Budget 2026-27 package",
        "explanation": """
            The complete Scottish Budget 2026-27 package combines both policy reforms:
            the SCP Premium for under-ones (£40/week for babies under 1) and the income tax
            threshold uplift (7.4% increase to basic and intermediate thresholds). Together,
            these measures deliver targeted support to families with young children while
            also providing tax relief to working Scots.
        """,
    },
    {
        "id": "scp_baby_boost",
        "name": "SCP Premium for under-ones (£40/week)",
        "description": "New SCP Premium for under-ones: £40/week for babies under 1",
        "explanation": """
            The new SCP Premium for under-ones increases the Scottish Child Payment to
            £40/week for families with babies under 1 year old, up from the standard rate
            of £27.15/week. This delivers the strongest package of support for families
            with young children anywhere in the UK, as announced by Finance Secretary
            Shona Robison on 13 January 2026.
        """,
    },
    {
        "id": "income_tax_threshold_uplift",
        "name": "Income tax threshold uplift (7.4%)",
        "description": "Scottish basic and intermediate rate thresholds increased by 7.4%",
        "explanation": """
            The Scottish basic and intermediate income tax rate thresholds are raised by 7.4%.
            The basic rate (20%) threshold rises from £15,398 to £16,537, and the intermediate
            rate (21%) threshold rises from £27,492 to £29,527. The higher rate (42%) remains
            unchanged at £43,663. This means people pay the lower 19% starter rate on more of
            their income.
        """,
    },
]

PRESETS = [
    {
        "id": "scottish-budget-2026",
        "name": "Scottish Budget 2026",
        "policies": ["scp_baby_boost", "income_tax_threshold_uplift"],
    },
]
