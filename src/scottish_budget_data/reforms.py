"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional
import numpy as np


# Constants for SCP
WEEKS_IN_YEAR = 52
SCP_2025_RATE = 27.15  # £/week (Apr 2025 rate, pre-budget baseline)
SCP_2026_RATE = 28.20  # £/week (Apr 2026 rate, announced in Scottish Budget)
SCP_BABY_RATE = 40.00  # £/week for babies under 1 (from 2027-28)
SCP_INFLATION_BOOST = SCP_2026_RATE - SCP_2025_RATE  # Extra £1.05/week
SCP_BABY_BOOST = SCP_BABY_RATE - SCP_2026_RATE  # Extra £11.80/week on top of 2026 rate


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


def _income_tax_threshold_uplift_modifier(sim):
    """Apply Scottish income tax threshold uplift (7.4%).

    From Scottish Budget 2026-27:
    - Basic rate (20%) threshold: £15,398 → £16,537 (+£1,139 absolute)
    - Intermediate rate (21%) threshold: £27,492 → £29,527 (+£2,035 absolute)

    Policy assumption for future years (2027-2030):
    The same absolute £ increase is maintained, meaning the gap between
    Scottish and baseline UK thresholds remains constant. This represents
    a "maintained policy" scenario showing consistent ~£63-68M/year cost.

    Alternative scenarios NOT modeled:
    - One-year only: Would show impact only in 2026-27, £0 thereafter
    - Threshold freeze: Would show decreasing impact as UK thresholds rise
    - Percentage-based: Would show growing cost with inflation
    """
    params = sim.tax_benefit_system.parameters
    scotland_rates = params.gov.hmrc.income_tax.rates.scotland.rates

    # The announced increases for 2026-27 (absolute amounts above baseline)
    # Basic: £15,398 → £16,537 = +£1,139
    # Intermediate: £27,492 → £29,527 = +£2,035
    # These translate to threshold-above-PA increases of:
    BASIC_INCREASE = 1_069  # £3,966 - £2,897 (2026 baseline)
    INTERMEDIATE_INCREASE = 1_665  # £16,956 - £15,291 (2026 baseline)

    # Update brackets for years 2026-2030
    # Apply the same absolute increase to each year's baseline
    for year in [2026, 2027, 2028, 2029, 2030]:
        # Get baseline thresholds
        baseline_basic = scotland_rates.brackets[1].threshold(f"{year}-01-01")
        baseline_intermediate = scotland_rates.brackets[2].threshold(f"{year}-01-01")

        # Apply the announced increases
        new_basic = baseline_basic + BASIC_INCREASE
        new_intermediate = baseline_intermediate + INTERMEDIATE_INCREASE

        scotland_rates.brackets[1].threshold.update(
            period=f"{year}-01-01",
            value=new_basic,
        )
        scotland_rates.brackets[2].threshold.update(
            period=f"{year}-01-01",
            value=new_intermediate,
        )

    return sim


def _scp_inflation_modifier(sim):
    """Apply SCP inflation increase (£27.15 → £28.20/week).

    The Scottish Budget 2026-27 announced the SCP will increase with inflation
    to £28.20/week from April 2026, up from £27.15/week.

    This applies to all eligible children under 16 in Scotland receiving
    qualifying benefits (approximated by UC receipt).
    """
    for year in [2026, 2027, 2028, 2029, 2030]:
        # Get person-level data
        age = sim.calculate("age", year, map_to="person")
        region = sim.calculate("region", year, map_to="person")

        # Identify eligible children (under 16) in Scotland
        is_child = np.array(age) < 16
        in_scotland = np.array(region) == "SCOTLAND"

        # Get UC reported to check for qualifying benefits
        uc_reported = sim.calculate("universal_credit_reported", year, map_to="benunit")
        receives_uc = np.array(uc_reported) > 0

        # Map eligible children in Scotland to benefit units
        children_per_benunit = sim.map_result(
            (is_child & in_scotland).astype(float), "person", "benunit"
        )

        # Calculate inflation boost (£1.05/week extra × 52 weeks per child)
        inflation_boost_per_benunit = np.where(
            receives_uc,
            np.array(children_per_benunit) * SCP_INFLATION_BOOST * WEEKS_IN_YEAR,
            0
        )

        # Map to person (head of benunit only)
        is_head = sim.calculate("is_benunit_head", year, map_to="person")
        inflation_boost_per_person = sim.map_result(
            inflation_boost_per_benunit, "benunit", "person"
        )

        inflation_boost_final = np.where(
            np.array(is_head),
            np.array(inflation_boost_per_person),
            0
        )

        # Add to private_transfer_income
        current_transfer = sim.calculate("private_transfer_income", year, map_to="person")
        new_transfer = np.array(current_transfer) + inflation_boost_final
        sim.set_input("private_transfer_income", year, new_transfer)

    return sim


def _scp_baby_boost_modifier(sim):
    """Apply SCP Premium for under-ones (£40/week for babies).

    The Scottish Budget 2026-27 announced this for 2027-28 onwards.
    Babies under 1 get £40/week total (£11.80 extra on top of £28.20 rate).

    Note: Only applies from 2027 onwards per the budget announcement.
    """
    # Baby boost only starts in 2027-28
    for year in [2027, 2028, 2029, 2030]:
        # Get person-level data
        age = sim.calculate("age", year, map_to="person")
        region = sim.calculate("region", year, map_to="person")

        # Identify babies (under 1) in Scotland
        is_baby = np.array(age) < 1
        in_scotland = np.array(region) == "SCOTLAND"

        # Get UC reported to check for qualifying benefits
        uc_reported = sim.calculate("universal_credit_reported", year, map_to="benunit")
        receives_uc = np.array(uc_reported) > 0

        # Map babies in Scotland to benefit units
        babies_per_benunit = sim.map_result(
            (is_baby & in_scotland).astype(float), "person", "benunit"
        )

        # Calculate baby boost (£11.80/week extra × 52 weeks per baby)
        baby_boost_per_benunit = np.where(
            receives_uc,
            np.array(babies_per_benunit) * SCP_BABY_BOOST * WEEKS_IN_YEAR,
            0
        )

        # Map to person (head of benunit only)
        is_head = sim.calculate("is_benunit_head", year, map_to="person")
        baby_boost_per_person = sim.map_result(
            baby_boost_per_benunit, "benunit", "person"
        )

        baby_boost_final = np.where(
            np.array(is_head),
            np.array(baby_boost_per_person),
            0
        )

        # Add to private_transfer_income
        current_transfer = sim.calculate("private_transfer_income", year, map_to="person")
        new_transfer = np.array(current_transfer) + baby_boost_final
        sim.set_input("private_transfer_income", year, new_transfer)

    return sim


def _combined_scottish_budget_modifier(sim):
    """Apply all Scottish Budget 2026-27 reforms together.

    Includes:
    1. SCP inflation increase (£27.15 → £28.20/week for all eligible children)
    2. SCP Premium for under-ones (£40/week for babies, from 2027-28)
    3. Income tax threshold uplift (7.4%)

    Note: Income tax modifier must run first to modify parameters before any
    calculations are performed. SCP modifiers run second to set input values.
    """
    sim = _income_tax_threshold_uplift_modifier(sim)
    sim = _scp_inflation_modifier(sim)
    sim = _scp_baby_boost_modifier(sim)
    return sim


def get_scottish_budget_reforms() -> list[Reform]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns:
        List of Reform objects for analysis.
    """
    reforms = []

    # Combined reform (all policies together) - listed first
    reforms.append(
        Reform(
            id="combined",
            name="All policies combined",
            description=(
                "Full Scottish Budget 2026-27 package: SCP inflation increase, "
                "SCP Premium for under-ones, and income tax threshold uplift."
            ),
            simulation_modifier=_combined_scottish_budget_modifier,
        )
    )

    # SCP inflation increase (£27.15 → £28.20/week)
    reforms.append(
        Reform(
            id="scp_inflation",
            name="SCP inflation increase (£28.20/week)",
            description=(
                "Scottish Child Payment increased with inflation to £28.20/week "
                "(up from £27.15/week) for all eligible children."
            ),
            simulation_modifier=_scp_inflation_modifier,
        )
    )

    # SCP Premium for under-ones (£40/week for babies, from 2027-28)
    reforms.append(
        Reform(
            id="scp_baby_boost",
            name="SCP Premium for under-ones (£40/week)",
            description=(
                "SCP Premium for under-ones: £40/week for babies under 1 "
                "(from 2027-28). Extra £11.80/week on top of £28.20 rate."
            ),
            simulation_modifier=_scp_baby_boost_modifier,
        )
    )

    # Scottish income tax threshold uplift (7.4%)
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
        "name": "All policies combined",
        "description": "Full Scottish Budget 2026-27 package",
        "explanation": """
            The complete Scottish Budget 2026-27 package combines all policy reforms:
            SCP inflation increase (£28.20/week), SCP Premium for under-ones (£40/week
            for babies from 2027-28), and income tax threshold uplift (7.4%). Together,
            these measures deliver targeted support to families while providing tax
            relief to working Scots.
        """,
    },
    {
        "id": "scp_inflation",
        "name": "SCP inflation increase (£28.20/week)",
        "description": "Scottish Child Payment increased to £28.20/week",
        "explanation": """
            The Scottish Child Payment increases with inflation to £28.20/week from
            April 2026, up from £27.15/week. This applies to all eligible children
            under 16 in families receiving qualifying benefits. Around 330,000
            children benefit from this increase.
        """,
    },
    {
        "id": "scp_baby_boost",
        "name": "SCP Premium for under-ones (£40/week)",
        "description": "£40/week for babies under 1 (from 2027-28)",
        "explanation": """
            The SCP Premium for under-ones increases the Scottish Child Payment to
            £40/week for families with babies under 1 year old, from 2027-28 onwards.
            This is £11.80/week extra on top of the £28.20 standard rate. Around
            12,000 children will benefit from this premium.
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
        "policies": ["scp_inflation", "scp_baby_boost", "income_tax_threshold_uplift"],
    },
]
