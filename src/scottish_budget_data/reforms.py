"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
Uses PolicyEngine's standard reform patterns with modify_parameters.
"""

from dataclasses import dataclass, field
from typing import Optional, Type, Union
from policyengine_core.reforms import Reform as PEReform


# Constants for income tax threshold uplift
# The announced increases for 2026-27 (absolute amounts above baseline)
INCOME_TAX_BASIC_INCREASE = 1_069  # Basic rate threshold increase
INCOME_TAX_INTERMEDIATE_INCREASE = 1_665  # Intermediate rate threshold increase

# Default years for microsim analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# PolicyEngine Reform Classes
# =============================================================================


class IncomeTaxThresholdUpliftReform(PEReform):
    """Reform that increases Scottish income tax thresholds by fixed amounts.

    From Scottish Budget 2026-27:
    - Basic rate (20%) threshold: +£1,069 above baseline
    - Intermediate rate (21%) threshold: +£1,665 above baseline
    """

    def apply(self):
        self.modify_parameters(modifier_function=self.modify_thresholds)

    @staticmethod
    def modify_thresholds(parameters):
        scotland_rates = parameters.gov.hmrc.income_tax.rates.scotland.rates

        for year in DEFAULT_YEARS:
            period = f"{year}-01-01"

            # Get baseline thresholds
            baseline_basic = scotland_rates.brackets[1].threshold(period)
            baseline_intermediate = scotland_rates.brackets[2].threshold(period)

            # Apply the announced increases
            scotland_rates.brackets[1].threshold.update(
                period=period,
                value=baseline_basic + INCOME_TAX_BASIC_INCREASE,
            )
            scotland_rates.brackets[2].threshold.update(
                period=period,
                value=baseline_intermediate + INCOME_TAX_INTERMEDIATE_INCREASE,
            )

        return parameters


class SCPBabyBoostReform(PEReform):
    """Reform that enables the SCP baby bonus from policyengine-uk.

    Sets gov.contrib.scotland.scottish_child_payment.in_effect to True,
    which activates £40/week for children under 1 (vs £27.15 standard).
    """

    def apply(self):
        self.modify_parameters(modifier_function=self.enable_baby_boost)

    @staticmethod
    def enable_baby_boost(parameters):
        scp_reform = parameters.gov.contrib.scotland.scottish_child_payment

        for year in DEFAULT_YEARS:
            scp_reform.in_effect.update(period=f"{year}-01-01", value=True)

        return parameters


class CombinedReform(PEReform):
    """Combined reform applying both SCP baby boost and income tax threshold uplift."""

    def apply(self):
        self.modify_parameters(modifier_function=self.modify_all)

    @staticmethod
    def modify_all(parameters):
        # Apply SCP baby boost
        parameters = SCPBabyBoostReform.enable_baby_boost(parameters)
        # Apply income tax threshold uplift
        parameters = IncomeTaxThresholdUpliftReform.modify_thresholds(parameters)
        return parameters


# =============================================================================
# Reform Definition (for dashboard use)
# =============================================================================


@dataclass
class ReformDefinition:
    """A policy reform definition for the dashboard."""

    id: str
    name: str
    description: str
    reform_class: Type[PEReform]

    def create_reform(self) -> PEReform:
        """Create an instance of the reform class."""
        return self.reform_class


def get_scottish_budget_reforms() -> list[ReformDefinition]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns:
        List of ReformDefinition objects.
    """
    return [
        ReformDefinition(
            id="combined",
            name="Both policies combined",
            description=(
                "Full Scottish Budget 2026-27 package: SCP Premium for under-ones (£40/week) "
                "and income tax threshold uplift (7.4%) applied together."
            ),
            reform_class=CombinedReform,
        ),
        ReformDefinition(
            id="scp_baby_boost",
            name="SCP Premium for under-ones (£40/week)",
            description=(
                "New SCP Premium for under-ones: £40/week for babies under 1 "
                "(up from £27.15/week). Announced in Scottish Budget 2026-27."
            ),
            reform_class=SCPBabyBoostReform,
        ),
        ReformDefinition(
            id="income_tax_threshold_uplift",
            name="Income tax threshold uplift (7.4%)",
            description=(
                "Scottish basic and intermediate rate thresholds increased by 7.4%. "
                "Basic rate starts at £16,537, intermediate at £29,527."
            ),
            reform_class=IncomeTaxThresholdUpliftReform,
        ),
    ]


# =============================================================================
# Policy metadata for dashboard UI
# =============================================================================

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
