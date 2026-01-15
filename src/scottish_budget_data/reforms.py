"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional
import numpy as np


# Constants for SCP Premium for under-ones
WEEKS_IN_YEAR = 52
SCP_STANDARD_RATE = 27.15  # £/week (current rate from Apr 2025)
SCP_BABY_RATE = 40.00  # £/week for babies under 1 (from Scottish Budget 2026)
SCP_BABY_BOOST = SCP_BABY_RATE - SCP_STANDARD_RATE  # Extra £12.85/week

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

    def to_scenario(self):
        """Convert to PolicyEngine Scenario."""
        from policyengine_uk.utils.scenario import Scenario

        if self.simulation_modifier and self.parameter_changes:
            return Scenario(
                simulation_modifier=self.simulation_modifier,
                parameter_changes=self.parameter_changes,
            )
        elif self.simulation_modifier:
            return Scenario(simulation_modifier=self.simulation_modifier)
        elif self.parameter_changes:
            return Scenario(parameter_changes=self.parameter_changes)
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


def apply_income_tax_threshold_uplift_for_year(sim, year: int):
    """Apply Scottish income tax threshold uplift for a single year.

    This is the core single-year function used by both microsim and personal calculator.

    From Scottish Budget 2026-27:
    - Basic rate (20%) threshold: £15,398 → £16,537 (+£1,139 absolute)
    - Intermediate rate (21%) threshold: £27,492 → £29,527 (+£2,035 absolute)

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


def _income_tax_threshold_uplift_modifier(sim):
    """Apply Scottish income tax threshold uplift (7.4%) for all years.

    Microsim wrapper that applies the uplift for years 2026-2030.

    Policy assumption for future years (2027-2030):
    The same absolute £ increase is maintained, meaning the gap between
    Scottish and baseline UK thresholds remains constant. This represents
    a "maintained policy" scenario showing consistent ~£63-68M/year cost.
    """
    for year in DEFAULT_YEARS:
        apply_income_tax_threshold_uplift_for_year(sim, year)
    return sim


def apply_scp_baby_boost_for_year(sim, year: int):
    """Apply SCP Premium for under-ones for a single year.

    This is the core single-year function used by both microsim and personal calculator.

    The Scottish Budget 2026-27 introduced the SCP Premium for under-ones,
    increasing SCP to £40/week for babies under 1, up from the standard £27.15/week.

    The premium applies to:
    - Households in Scotland (already receiving SCP)
    - With children under 1 year old
    - Receiving qualifying benefits (checked via existing SCP > 0)

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
    # This sums is_baby (0 or 1) for each person, grouped by benunit
    babies_per_benunit = sim.map_result(is_baby.astype(float), "person", "benunit")

    # Calculate baby boost (£12.85/week extra × 52 weeks per baby)
    annual_boost = np.array(babies_per_benunit) * SCP_BABY_BOOST * WEEKS_IN_YEAR

    # Only apply boost to families already receiving SCP (i.e., in Scotland + qualifying)
    already_receives_scp = np.array(current_scp) > 0
    baby_boost = np.where(already_receives_scp, annual_boost, 0)

    # Add boost to current SCP
    new_scp = np.array(current_scp) + baby_boost
    sim.set_input("scottish_child_payment", year, new_scp)


def _scp_baby_boost_modifier(sim):
    """Apply SCP Premium for under-ones for all years.

    Microsim wrapper that applies the baby boost for years 2026-2030.
    """
    for year in DEFAULT_YEARS:
        apply_scp_baby_boost_for_year(sim, year)
    return sim


def _combined_scottish_budget_modifier(sim):
    """Apply both SCP Premium for under-ones and income tax threshold uplift together.

    This combined reform represents the full Scottish Budget 2026-27 package,
    applying both policies simultaneously to capture any interaction effects.

    Note: Income tax modifier must run first to modify parameters before any
    calculations are performed. SCP modifier runs second to set input values.
    """
    sim = _income_tax_threshold_uplift_modifier(sim)
    sim = _scp_baby_boost_modifier(sim)
    return sim


def get_scottish_budget_reforms() -> list[Reform]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns:
        List of Reform objects for analysis.
    """
    reforms = []

    # Combined reform (both policies together) - listed first
    reforms.append(
        Reform(
            id="combined",
            name="Both policies combined",
            description=(
                "Full Scottish Budget 2026-27 package: SCP Premium for under-ones (£40/week) "
                "and income tax threshold uplift (7.4%) applied together."
            ),
            simulation_modifier=_combined_scottish_budget_modifier,
        )
    )

    # SCP Premium for under-ones (£40/week for babies under 1)
    # This is the main reform from Scottish Budget 2026-27
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
    # Raises basic and intermediate rate thresholds per Scottish Budget 2026-27
    # Basic (20%): £15,398 → £16,537 absolute = £3,966 above PA
    # Intermediate (21%): £27,492 → £29,527 absolute = £16,956 above PA
    reforms.append(
        Reform(
            id="income_tax_threshold_uplift",
            name="Income tax threshold uplift (7.4%)",
            description=(
                "Scottish basic and intermediate rate thresholds increased by 7.4%. "
                "Basic rate starts at £16,537, intermediate at £29,527."
            ),
simulation_modifier=_income_tax_threshold_uplift_modifier,
        )
    )

    return reforms


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
