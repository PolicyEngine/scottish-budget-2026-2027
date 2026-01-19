"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
Uses function-based parameter modification for compatibility with Microsimulation.
"""

from dataclasses import dataclass
from typing import Callable

from policyengine_uk import Microsimulation


# Scottish Budget 2026-27 income tax thresholds
# Source: Scottish Income Tax 2026-27 Technical Factsheet, Table 1
# https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
#
# 2026-27 reform thresholds (amounts above PA of £12,570):
#   Starter (19%): up to £16,537 → threshold = £3,967 above PA
#   Basic (20%): up to £29,526 → threshold = £16,956 above PA
#
# Baseline (2025-26) thresholds are read from PolicyEngine UK at runtime.
# Both baseline and reform are FROZEN (no uprating in future years).
INCOME_TAX_STARTER_THRESHOLD = 3_967  # £16,537 total - £12,570 PA
INCOME_TAX_BASIC_THRESHOLD = 16_956  # £29,526 total - £12,570 PA


def _get_baseline_scottish_thresholds() -> tuple[float, float]:
    """Get 2025-26 Scottish income tax thresholds from PolicyEngine UK.

    Returns:
        Tuple of (starter_threshold, basic_threshold) as amounts above PA.
    """
    from policyengine_uk.system import system
    params = system.parameters.gov.hmrc.income_tax.rates.scotland.rates
    starter = params.brackets[1].threshold("2025-01-01")
    basic = params.brackets[2].threshold("2025-01-01")
    return starter, basic

# SCP rates
# Source: Scottish Budget 2026-27
# https://www.gov.scot/news/a-budget-to-tackle-child-poverty/
SCP_BASELINE_RATE = 27.15  # £/week (current rate from Apr 2025)
SCP_INFLATION_RATE = 28.20  # £/week (inflation-adjusted from Apr 2026)
SCP_PREMIUM_UNDER_ONE_AMOUNT = 40  # £/week total for under-1s

# Default years for microsim analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# Reform Application Functions
# =============================================================================


def apply_scp_inflation_reform(sim: Microsimulation) -> None:
    """Apply SCP inflation adjustment to a simulation.

    Updates SCP amount from £27.15/week to £28.20/week (+3.9% inflation).
    This is applied BEFORE the baby boost so the baby boost correctly
    calculates as £40 - £28.20 = £11.80/week extra.

    Note: SCP amount parameter is stored as £/week (not annual).

    Source: Scottish Budget 2026-27
    https://www.gov.scot/news/a-budget-to-tackle-child-poverty/
    """
    scp_amount = sim.tax_benefit_system.parameters.gov.social_security_scotland.scottish_child_payment.amount

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        scp_amount.update(period=period, value=SCP_INFLATION_RATE)  # £/week


def apply_income_tax_baseline(sim: Microsimulation) -> None:
    """Apply baseline (2025-26) Scottish income tax thresholds, frozen for all years.

    This represents what would have happened WITHOUT the 2026-27 budget:
    thresholds frozen at 2025-26 levels (no uprating).

    Source: https://www.mygov.scot/scottish-income-tax
    """
    starter_baseline, basic_baseline = _get_baseline_scottish_thresholds()
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        scotland_rates.brackets[1].threshold.update(
            period=period, value=starter_baseline
        )
        scotland_rates.brackets[2].threshold.update(
            period=period, value=basic_baseline
        )


def apply_income_tax_threshold_reform(sim: Microsimulation) -> None:
    """Apply income tax threshold uplift (2026-27 values), frozen for all years.

    Sets Scottish income tax thresholds to Budget 2026-27 values:
    - Starter rate (19%): up to £16,537 (£3,967 above PA)
    - Basic rate (20%): up to £29,526 (£16,956 above PA)

    Thresholds are then frozen at these levels (no uprating in future years).

    Source: Scottish Income Tax 2026-27 Technical Factsheet, Table 1
    https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        scotland_rates.brackets[1].threshold.update(
            period=period, value=INCOME_TAX_STARTER_THRESHOLD
        )
        scotland_rates.brackets[2].threshold.update(
            period=period, value=INCOME_TAX_BASIC_THRESHOLD
        )


def apply_scp_baby_boost_reform(sim: Microsimulation) -> None:
    """Apply SCP baby boost reform to a simulation.

    Enables the SCP baby bonus via the contrib parameters.
    This gives £40/week total for under-1s (vs £28.20 inflation-adjusted).

    Note: The SCP Premium for under-ones takes effect from 2027, not 2026.

    Note: Uses contrib parameters for policyengine-uk < 2.70.0.
    Once the main parameters are available, this should switch to using
    gov.social_security_scotland.scottish_child_payment.premium_under_one_amount.

    Source: Scottish Budget 2026-27
    https://www.gov.scot/publications/scottish-budget-2026-2027/
    """
    scp_reform = sim.tax_benefit_system.parameters.gov.contrib.scotland.scottish_child_payment

    # Baby boost takes effect from 2027, not 2026
    for year in DEFAULT_YEARS:
        if year >= 2027:
            period = f"{year}-01-01"
            # Enable the baby bonus
            scp_reform.in_effect.update(period=period, value=True)


def apply_combined_reform(sim: Microsimulation) -> None:
    """Apply all Scottish Budget 2026-27 reforms to a simulation.

    Order matters: SCP inflation must be applied before baby boost
    so the baby boost correctly stacks on top of £28.20/week.
    """
    apply_scp_inflation_reform(sim)  # £27.15 → £28.20/week
    apply_income_tax_threshold_reform(sim)  # 7.4% threshold uplift
    apply_scp_baby_boost_reform(sim)  # £40/week for under-1s


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
    baseline_apply_fn: Callable[[Microsimulation], None] | None = None


def get_scottish_budget_reforms() -> list[ReformDefinition]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns:
        List of ReformDefinition objects.
    """
    return [
        ReformDefinition(
            id="combined",
            name="All policies combined",
            description=(
                "Full Scottish Budget 2026-27 package: SCP inflation adjustment (£28.20/week), "
                "SCP Premium for under-ones (£40/week), and income tax threshold uplift (7.4%)."
            ),
            apply_fn=apply_combined_reform,
            explanation=(
                "The complete Scottish Budget 2026-27 package combines all three policy reforms: "
                "the SCP inflation adjustment (£28.20/week), the SCP Premium for under-ones "
                "(£40/week total for babies under 1), and the income tax threshold uplift (7.4% "
                "increase to basic and intermediate thresholds). Together, these measures deliver "
                "targeted support to families with young children while also providing tax relief "
                "to working Scots."
            ),
        ),
        ReformDefinition(
            id="scp_inflation",
            name="SCP inflation adjustment (£28.20/week)",
            description=(
                "Scottish Child Payment uprated with inflation from £27.15/week to £28.20/week "
                "(+£1.05/week). Effective April 2026."
            ),
            apply_fn=apply_scp_inflation_reform,
            explanation=(
                "The Scottish Child Payment is uprated with inflation from £27.15/week to "
                "£28.20/week (+£1.05/week, or +3.9%). This inflation adjustment takes effect "
                "from April 2026 and benefits all families receiving the Scottish Child Payment, "
                "providing approximately £55 extra per child per year."
            ),
        ),
        ReformDefinition(
            id="scp_baby_boost",
            name="SCP Premium for under-ones (£40/week)",
            description=(
                "SCP Premium for under-ones: £40/week total for babies under 1 "
                "(£11.80/week extra on top of the inflation-adjusted £28.20/week rate)."
            ),
            apply_fn=apply_scp_baby_boost_reform,
            explanation=(
                "The new SCP Premium for under-ones increases the Scottish Child Payment to "
                "£40/week total for families with babies under 1 year old. This is £11.80/week "
                "extra on top of the inflation-adjusted rate of £28.20/week. This delivers the "
                "strongest package of support for families with young children anywhere in the UK, "
                "as announced by Finance Secretary Shona Robison on 13 January 2026."
            ),
        ),
        ReformDefinition(
            id="income_tax_threshold_uplift",
            name="Income tax threshold uplift",
            description=(
                "Scottish starter and basic rate thresholds increased for 2026-27. "
                "Starter rate up to £16,537, basic rate up to £29,526. Thresholds then frozen."
            ),
            apply_fn=apply_income_tax_threshold_reform,
            baseline_apply_fn=apply_income_tax_baseline,
            explanation=(
                "The Scottish starter and basic income tax thresholds are raised for 2026-27. "
                "The starter rate (19%) threshold rises from £15,397 to £16,537 (+£1,140), and "
                "the basic rate (20%) threshold rises from £27,491 to £29,526 (+£2,035). "
                "Thresholds are then frozen at these levels. This means people pay the lower "
                "19% starter rate on more of their income."
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
        "policies": ["scp_inflation", "scp_baby_boost", "income_tax_threshold_uplift"],
    },
]
