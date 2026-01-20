"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
Uses function-based parameter modification for compatibility with Microsimulation.
"""

from dataclasses import dataclass
from typing import Callable

from policyengine_uk import Microsimulation


# Scottish Budget 2026-27 income tax thresholds (base values for 2026-27)
# Source: Scottish Income Tax 2026-27 Technical Factsheet, Table 1
# https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
#
# PolicyEngine stores thresholds as amounts ABOVE personal allowance (£12,570)
# These base values are CPI uprated dynamically using PE UK's CPI index
INCOME_TAX_BASIC_THRESHOLD_2026 = 3_968   # £16,538 total - £12,570 PA
INCOME_TAX_INTERMEDIATE_THRESHOLD_2026 = 16_957  # £29,527 total - £12,570 PA

# Frozen threshold values for higher/advanced/top rates (2027-28 onwards)
# Source: Scottish Income Tax 2026-27 Technical Factsheet
# https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
# These are the 2026-27 thresholds to be frozen for 2027-28 and 2028-29.
# Note: 2026 freeze is already in baseline per Budget 2025-26
#
# Band thresholds (total income → above PA):
#   Higher (42%): £43,663 → £31,093 above PA
#   Advanced (45%): £75,001 → £62,431 above PA
#   Top (48%): £125,141 → £112,571 above PA
INCOME_TAX_HIGHER_THRESHOLD = 31_093  # £43,663 total - £12,570 PA
INCOME_TAX_ADVANCED_THRESHOLD = 62_431  # £75,001 total - £12,570 PA
INCOME_TAX_TOP_THRESHOLD = 112_571  # £125,141 total - £12,570 PA

# SCP rates
# Source: Scottish Budget 2026-27
# https://www.gov.scot/news/a-budget-to-tackle-child-poverty/
SCP_BASELINE_RATE = 27.15  # £/week (current rate from Apr 2025)
SCP_INFLATION_RATE = 28.20  # £/week (inflation-adjusted from Apr 2026)
SCP_PREMIUM_UNDER_ONE_AMOUNT = 40  # £/week total for under-1s

# Default years for microsim analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# Helper Functions
# =============================================================================


def get_cpi_uprated_value(sim: Microsimulation, base_value: float, base_year: int, target_year: int) -> float:
    """Calculate CPI-uprated value using PE UK's CPI index.

    Args:
        sim: Microsimulation instance to read CPI from
        base_value: The value in the base year
        base_year: The year of the base value
        target_year: The year to uprate to

    Returns:
        The CPI-uprated value for the target year
    """
    if target_year <= base_year:
        return base_value

    cpi = sim.tax_benefit_system.parameters.gov.economic_assumptions.indices.obr.consumer_price_index

    # Get CPI index values for base and target years
    base_period = f"{base_year}-01-01"
    target_period = f"{target_year}-01-01"

    cpi_base = cpi(base_period)
    cpi_target = cpi(target_period)

    # Calculate uprated value
    uprating_factor = cpi_target / cpi_base
    return round(base_value * uprating_factor)


# =============================================================================
# Reform Application Functions
# =============================================================================


def apply_scp_inflation_reform(sim: Microsimulation) -> None:
    """Apply SCP inflation adjustment to a simulation.

    Updates SCP amount from £27.15/week to £28.20/week (+3.9% inflation).
    This is applied BEFORE the baby boost. Note: baby boost starts 2027-28
    when SCP rate is £28.85/week, so premium = £40 - £28.85 = £11.15/week.

    Note: SCP amount parameter is stored as £/week (not annual).

    Source: Scottish Budget 2026-27
    https://www.gov.scot/news/a-budget-to-tackle-child-poverty/
    """
    scp_amount = sim.tax_benefit_system.parameters.gov.social_security_scotland.scottish_child_payment.amount

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        scp_amount.update(period=period, value=SCP_INFLATION_RATE)  # £/week


def apply_basic_rate_uplift_reform(sim: Microsimulation) -> None:
    """Apply basic rate threshold uplift only.

    Increases Scottish basic rate (20%) threshold by 7.4% in 2026, then CPI uprated.
    Basic rate starts at £16,538 (£3,968 above PA) in 2026-27.

    Uses PE UK's CPI index for consistent uprating with baseline.

    Source: SFC costings breakdown - "Basic rate threshold +7.4%"
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        basic_threshold = get_cpi_uprated_value(
            sim, INCOME_TAX_BASIC_THRESHOLD_2026, 2026, year
        )
        scotland_rates.brackets[1].threshold.update(
            period=period, value=basic_threshold
        )


def apply_intermediate_rate_uplift_reform(sim: Microsimulation) -> None:
    """Apply intermediate rate threshold uplift only.

    Increases Scottish intermediate rate (21%) threshold by 7.4% in 2026, then CPI uprated.
    Intermediate rate starts at £29,527 (£16,957 above PA) in 2026-27.

    Uses PE UK's CPI index for consistent uprating with baseline.

    Source: SFC costings breakdown - "Intermediate rate threshold +7.4%"
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        period = f"{year}-01-01"
        intermediate_threshold = get_cpi_uprated_value(
            sim, INCOME_TAX_INTERMEDIATE_THRESHOLD_2026, 2026, year
        )
        scotland_rates.brackets[2].threshold.update(
            period=period, value=intermediate_threshold
        )


def apply_higher_rate_freeze_reform(sim: Microsimulation) -> None:
    """Apply higher rate threshold freeze for 2027-28 and 2028-29.

    Freezes Scottish higher rate (42%) threshold at £31,092 (above PA).
    Total threshold: £43,662.

    Note: 2026 freeze is already in baseline per Budget 2025-26.
    This only applies to 2027+ to measure the incremental cost.

    Source: SFC costings breakdown - "Higher rate freeze"
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        if year >= 2027:
            period = f"{year}-01-01"
            scotland_rates.brackets[3].threshold.update(
                period=period, value=INCOME_TAX_HIGHER_THRESHOLD
            )


def apply_advanced_rate_freeze_reform(sim: Microsimulation) -> None:
    """Apply advanced rate threshold freeze for 2027-28 and 2028-29.

    Freezes Scottish advanced rate (45%) threshold at £49,860 (above PA).
    Total threshold: £62,430.

    Note: 2026 freeze is already in baseline per Budget 2025-26.
    This only applies to 2027+ to measure the incremental cost.

    Source: SFC costings breakdown - "Advanced rate freeze"
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        if year >= 2027:
            period = f"{year}-01-01"
            scotland_rates.brackets[4].threshold.update(
                period=period, value=INCOME_TAX_ADVANCED_THRESHOLD
            )


def apply_top_rate_freeze_reform(sim: Microsimulation) -> None:
    """Apply top rate threshold freeze for 2027-28 and 2028-29.

    Freezes Scottish top rate (48%) threshold at £112,570 (above PA).
    Total threshold: £125,140.

    Note: 2026 freeze is already in baseline per Budget 2025-26.
    This only applies to 2027+ to measure the incremental cost.

    Source: SFC costings breakdown - "Top rate freeze"
    """
    scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates

    for year in DEFAULT_YEARS:
        if year >= 2027:
            period = f"{year}-01-01"
            scotland_rates.brackets[5].threshold.update(
                period=period, value=INCOME_TAX_TOP_THRESHOLD
            )


def disable_scp_baby_boost(sim: Microsimulation) -> None:
    """Disable SCP baby boost to create counterfactual baseline.

    The baby boost is already in the PolicyEngine UK baseline from 2027+.
    This function disables it so we can measure the impact of enabling it.
    """
    scp_reform = sim.tax_benefit_system.parameters.gov.contrib.scotland.scottish_child_payment

    for year in DEFAULT_YEARS:
        if year >= 2027:
            period = f"{year}-01-01"
            scp_reform.in_effect.update(period=period, value=False)


def apply_scp_baby_boost_reform(sim: Microsimulation) -> None:
    """Apply SCP baby boost reform to a simulation.

    Enables the SCP baby bonus via the contrib parameters.
    This gives £40/week total for under-1s (£11.15/week extra in 2027-28
    when standard rate is £28.85/week). Both total and rate CPI uprated.

    Note: The SCP Premium for under-ones takes effect from 2027, not 2026.
    Note: The baseline already has this enabled, so we need to use
    disable_scp_baby_boost() on the baseline to measure the impact.

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
    apply_basic_rate_uplift_reform(sim)  # Basic rate +7.4%
    apply_intermediate_rate_uplift_reform(sim)  # Intermediate rate +7.4%
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
                "(£11.15/week extra in 2027-28). Both total and standard rate CPI uprated annually."
            ),
            apply_fn=apply_scp_baby_boost_reform,
            explanation=(
                "The new SCP Premium for under-ones increases the Scottish Child Payment to "
                "£40/week total for families with babies under 1 year old (£11.15/week extra "
                "in 2027-28 when standard rate is £28.85/week). Both the total and standard rate "
                "are CPI uprated annually. This delivers the strongest package of support for "
                "families with young children anywhere in the UK, as announced by Finance "
                "Secretary Shona Robison on 13 January 2026."
            ),
        ),
        ReformDefinition(
            id="income_tax_basic_uplift",
            name="Basic rate threshold +7.4%",
            description=(
                "Scottish basic rate (20%) threshold increased by 7.4% in 2026-27, then CPI uprated. "
                "Basic rate starts at £16,538 (£3,968 above personal allowance)."
            ),
            apply_fn=apply_basic_rate_uplift_reform,
            explanation=(
                "The Scottish basic rate (20%) threshold is raised by 7.4% in 2026-27, then CPI "
                "uprated annually. The threshold rises from £15,398 to £16,538 total taxable income "
                "(£3,968 above the personal allowance of £12,570). This means people pay the lower "
                "19% starter rate on more of their income before moving to the 20% basic rate."
            ),
        ),
        ReformDefinition(
            id="income_tax_intermediate_uplift",
            name="Intermediate rate threshold +7.4%",
            description=(
                "Scottish intermediate rate (21%) threshold increased by 7.4% in 2026-27, then CPI uprated. "
                "Intermediate rate starts at £29,527 (£16,957 above personal allowance)."
            ),
            apply_fn=apply_intermediate_rate_uplift_reform,
            explanation=(
                "The Scottish intermediate rate (21%) threshold is raised by 7.4% in 2026-27, then "
                "CPI uprated annually. The threshold rises from £27,492 to £29,527 total taxable "
                "income (£16,957 above the personal allowance). This means people pay the lower 20% "
                "basic rate on more of their income before moving to the 21% intermediate rate."
            ),
        ),
        ReformDefinition(
            id="higher_rate_freeze",
            name="Higher rate threshold freeze",
            description=(
                "Scottish higher rate (42%) threshold frozen at £43,662 for 2027-28 and 2028-29. "
                "2026 freeze is already in baseline per Budget 2025-26."
            ),
            apply_fn=apply_higher_rate_freeze_reform,
            explanation=(
                "The Scottish higher rate (42%) threshold is frozen at £43,662 (£31,092 above "
                "the personal allowance) for 2027-28 and 2028-29. Note that the 2026 freeze is "
                "already in the baseline per Budget 2025-26, so this reform only captures the "
                "incremental revenue from extending the freeze into future years."
            ),
        ),
        ReformDefinition(
            id="advanced_rate_freeze",
            name="Advanced rate threshold freeze",
            description=(
                "Scottish advanced rate (45%) threshold frozen at £62,430 for 2027-28 and 2028-29. "
                "2026 freeze is already in baseline per Budget 2025-26."
            ),
            apply_fn=apply_advanced_rate_freeze_reform,
            explanation=(
                "The Scottish advanced rate (45%) threshold is frozen at £62,430 (£49,860 above "
                "the personal allowance) for 2027-28 and 2028-29. Note that the 2026 freeze is "
                "already in the baseline per Budget 2025-26, so this reform only captures the "
                "incremental revenue from extending the freeze into future years."
            ),
        ),
        ReformDefinition(
            id="top_rate_freeze",
            name="Top rate threshold freeze",
            description=(
                "Scottish top rate (48%) threshold frozen at £125,140 for 2027-28 and 2028-29. "
                "2026 freeze is already in baseline per Budget 2025-26."
            ),
            apply_fn=apply_top_rate_freeze_reform,
            explanation=(
                "The Scottish top rate (48%) threshold is frozen at £125,140 (£112,570 above "
                "the personal allowance) for 2027-28 and 2028-29. Note that the 2026 freeze is "
                "already in the baseline per Budget 2025-26, so this reform only captures the "
                "incremental revenue from extending the freeze into future years."
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
