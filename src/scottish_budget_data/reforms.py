"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
Uses function-based parameter modification for compatibility with Microsimulation.
"""

from dataclasses import dataclass
from typing import Callable

from policyengine_uk import Microsimulation


# Scottish Budget 2026-27 income tax thresholds (absolute values)
# Source: Scottish Income Tax 2026-27 Technical Factsheet, Table 1
# https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
#
# Total taxable income thresholds:
#   Basic rate (20%): £16,538 - £29,526
#   Intermediate rate (21%): £29,527 - £43,662
#
# PolicyEngine stores thresholds as amounts ABOVE personal allowance (£12,570)
INCOME_TAX_BASIC_THRESHOLD = 3_967  # £16,537 total - £12,570 PA
INCOME_TAX_INTERMEDIATE_THRESHOLD = 16_956  # £29,526 total - £12,570 PA

# SCP Premium for under-ones: £40/week (total, not on top of standard)
# Source: Scottish Budget 2026-27
SCP_PREMIUM_UNDER_ONE_AMOUNT = 40

# Default years for microsim analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# Reform Application Functions
# =============================================================================


def apply_income_tax_threshold_reform(sim: Microsimulation) -> None:
    """Apply income tax threshold uplift to a simulation.

    Sets Scottish income tax thresholds to Budget 2026-27 values:
    - Basic rate (20%): starts at £16,537 (£3,967 above PA)
    - Intermediate rate (21%): starts at £29,526 (£16,956 above PA)

    Source: Scottish Income Tax 2026-27 Technical Factsheet, Table 1
    https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        scotland_rates.brackets[1].threshold.update(
            period=period, value=INCOME_TAX_BASIC_THRESHOLD
        )
        scotland_rates.brackets[2].threshold.update(
            period=period, value=INCOME_TAX_INTERMEDIATE_THRESHOLD
        )


def apply_scp_baby_boost_reform(sim: Microsimulation) -> None:
    """Apply SCP baby boost reform to a simulation.

    Enables the SCP baby bonus via the contrib parameters.
    This gives £40/week total for under-1s (vs £27.15 standard).

    Note: Uses contrib parameters for policyengine-uk < 2.70.0.
    Once the main parameters are available, this should switch to using
    gov.social_security_scotland.scottish_child_payment.premium_under_one_amount.

    Source: Scottish Budget 2026-27
    https://www.gov.scot/publications/scottish-budget-2026-2027/
    """
    scp_reform = sim.tax_benefit_system.parameters.gov.contrib.scotland.scottish_child_payment

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        # Enable the baby bonus
        scp_reform.in_effect.update(period=period, value=True)


def apply_combined_reform(sim: Microsimulation) -> None:
    """Apply both reforms to a simulation."""
    apply_income_tax_threshold_reform(sim)
    apply_scp_baby_boost_reform(sim)


# =============================================================================
# Reform Definition (for dashboard use)
# =============================================================================


@dataclass
class ReformDefinition:
    """A policy reform definition for the dashboard."""

    id: str
    name: str
    description: str
    apply_fn: Callable[[Microsimulation], None]
    explanation: str = ""


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
            apply_fn=apply_combined_reform,
            explanation=(
                "The complete Scottish Budget 2026-27 package combines both policy reforms: "
                "the SCP Premium for under-ones (£40/week for babies under 1) and the income tax "
                "threshold uplift (7.4% increase to basic and intermediate thresholds). Together, "
                "these measures deliver targeted support to families with young children while "
                "also providing tax relief to working Scots."
            ),
        ),
        ReformDefinition(
            id="scp_baby_boost",
            name="SCP Premium for under-ones (£40/week)",
            description=(
                "New SCP Premium for under-ones: £40/week for babies under 1 "
                "(up from £27.15/week). Announced in Scottish Budget 2026-27."
            ),
            apply_fn=apply_scp_baby_boost_reform,
            explanation=(
                "The new SCP Premium for under-ones increases the Scottish Child Payment to "
                "£40/week for families with babies under 1 year old, up from the standard rate "
                "of £27.15/week. This delivers the strongest package of support for families "
                "with young children anywhere in the UK, as announced by Finance Secretary "
                "Shona Robison on 13 January 2026."
            ),
        ),
        ReformDefinition(
            id="income_tax_threshold_uplift",
            name="Income tax threshold uplift (7.4%)",
            description=(
                "Scottish basic and intermediate rate thresholds increased by 7.4%. "
                "Basic rate starts at £16,537, intermediate at £29,527."
            ),
            apply_fn=apply_income_tax_threshold_reform,
            explanation=(
                "The Scottish basic and intermediate income tax rate thresholds are raised by 7.4%. "
                "The basic rate (20%) threshold rises from £15,398 to £16,537, and the intermediate "
                "rate (21%) threshold rises from £27,492 to £29,527. The higher rate (42%) remains "
                "unchanged at £43,663. This means people pay the lower 19% starter rate on more of "
                "their income."
            ),
        ),
    ]


def get_policies_metadata() -> list[dict]:
    """Get policy metadata for dashboard UI, derived from reform definitions."""
    return [
        {
            "id": reform.id,
            "name": reform.name,
            "description": reform.description,
            "explanation": reform.explanation,
        }
        for reform in get_scottish_budget_reforms()
    ]


# For backwards compatibility
POLICIES = get_policies_metadata()

PRESETS = [
    {
        "id": "scottish-budget-2026",
        "name": "Scottish Budget 2026",
        "policies": ["scp_baby_boost", "income_tax_threshold_uplift"],
    },
]
