"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional
import numpy as np


# Constants for SCP baby boost
WEEKS_IN_YEAR = 52
SCP_STANDARD_RATE = 27.15  # £/week (current rate from Apr 2025)
SCP_BABY_RATE = 40.00  # £/week for babies under 1 (from Scottish Budget 2026)
SCP_BABY_BOOST = SCP_BABY_RATE - SCP_STANDARD_RATE  # Extra £12.85/week


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


def _scp_baby_boost_modifier(sim):
    """Apply Scottish Child Payment baby boost for children under 1.

    The Scottish Budget 2026-27 increased SCP to £40/week for babies under 1,
    up from the standard £27.15/week. This modifier adds the extra payment
    directly to the scottish_child_payment variable for eligible families.

    The boost applies to:
    - Households in Scotland (already receiving SCP)
    - With children under 1 year old
    - Receiving qualifying benefits (checked via existing SCP > 0)
    """
    for year in [2026, 2027, 2028, 2029, 2030]:
        # Get current SCP values (already filters for Scotland + qualifying benefits)
        current_scp = sim.calculate("scottish_child_payment", year)

        # Get person-level age to count babies
        age = sim.calculate("age", year, map_to="person")
        is_baby = np.array(age) < 1

        # Map babies to benefit units
        person_benunit_id = sim.calculate("benunit_id", year, map_to="person")
        benunit_id = sim.calculate("benunit_id", year, map_to="benunit")

        # Count babies per benefit unit
        babies_per_benunit = np.zeros(len(benunit_id))
        bu_id_to_idx = {bu_id: idx for idx, bu_id in enumerate(benunit_id)}

        for person_bu_id, baby in zip(person_benunit_id, is_baby):
            if baby and person_bu_id in bu_id_to_idx:
                babies_per_benunit[bu_id_to_idx[person_bu_id]] += 1

        # Calculate baby boost (£12.85/week extra × 52 weeks per baby)
        annual_boost = babies_per_benunit * SCP_BABY_BOOST * WEEKS_IN_YEAR

        # Only apply boost to families already receiving SCP (i.e., in Scotland + qualifying)
        already_receives_scp = np.array(current_scp) > 0
        baby_boost = np.where(already_receives_scp, annual_boost, 0)

        # Add boost to current SCP
        new_scp = np.array(current_scp) + baby_boost
        sim.set_input("scottish_child_payment", year, new_scp)

    return sim


def get_scottish_budget_reforms() -> list[Reform]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns:
        List of Reform objects for analysis.
    """
    reforms = []

    # SCP Baby Boost (£40/week for babies under 1)
    # This is the main reform from Scottish Budget 2026-27
    reforms.append(
        Reform(
            id="scp_baby_boost",
            name="SCP baby boost (£40/week)",
            description=(
                "Scottish Child Payment boosted to £40/week for babies under 1 "
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
            parameter_changes={
                "gov.hmrc.income_tax.rates.scotland.rates[1].threshold": {
                    "2026-04-06.2030-04-05": 3_966,  # Basic: £16,537 - £12,571 PA
                },
                "gov.hmrc.income_tax.rates.scotland.rates[2].threshold": {
                    "2026-04-06.2030-04-05": 16_956,  # Intermediate: £29,527 - £12,571 PA
                },
            },
        )
    )

    # Combined Scottish Budget 2026-27 reform
    # Combines all individual reforms into a single scenario
    reforms.append(
        Reform(
            id="scottish_budget_2026",
            name="Scottish Budget 2026-27",
            description=(
                "Full Scottish Budget 2026-27 package: SCP baby boost (£40/week for under 1s) "
                "plus income tax threshold uplift (7.4%)."
            ),
            parameter_changes={
                "gov.hmrc.income_tax.rates.scotland.rates[1].threshold": {
                    "2026-04-06.2030-04-05": 3_966,  # Basic: £16,537 - £12,571 PA
                },
                "gov.hmrc.income_tax.rates.scotland.rates[2].threshold": {
                    "2026-04-06.2030-04-05": 16_956,  # Intermediate: £29,527 - £12,571 PA
                },
            },
            simulation_modifier=_scp_baby_boost_modifier,
        )
    )

    return reforms


# Policy metadata for dashboard
POLICIES = [
    {
        "id": "scp_baby_boost",
        "name": "SCP baby boost (£40/week)",
        "description": "Scottish Child Payment boosted to £40/week for babies under 1",
        "explanation": """
            The Scottish Child Payment is boosted to £40/week for families with babies
            under 1 year old, up from the standard rate of £27.15/week. This delivers
            the strongest package of support for families with young children anywhere
            in the UK, as announced by Finance Secretary Shona Robison on 13 January 2026.
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
    {
        "id": "scottish_budget_2026",
        "name": "Scottish Budget 2026-27",
        "description": "Full Scottish Budget 2026-27 package",
        "explanation": """
            The complete Scottish Budget 2026-27 package combining:
            - SCP baby boost: £40/week for babies under 1 (up from £27.15/week)
            - Income tax threshold uplift: Basic and intermediate rate thresholds increased by 7.4%
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
