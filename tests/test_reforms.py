"""Tests for Scottish Budget reform definitions."""

import pytest


def test_get_scottish_budget_reforms_returns_eight_reforms():
    """Test that get_scottish_budget_reforms returns exactly 8 reforms."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms

    reforms = get_scottish_budget_reforms()
    assert len(reforms) == 8


def test_reform_ids():
    """Test that reforms have expected IDs."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms

    reforms = get_scottish_budget_reforms()
    reform_ids = {r.id for r in reforms}

    expected_ids = {
        "combined",
        "scp_inflation",
        "scp_baby_boost",
        "income_tax_basic_uplift",
        "income_tax_intermediate_uplift",
        "higher_rate_freeze",
        "advanced_rate_freeze",
        "top_rate_freeze",
    }
    assert reform_ids == expected_ids


def test_all_reforms_have_apply_fn():
    """Test that all reforms have an apply function."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms

    reforms = get_scottish_budget_reforms()
    for reform in reforms:
        assert reform.apply_fn is not None, (
            f"Reform {reform.id} should have an apply_fn"
        )
        assert callable(reform.apply_fn), (
            f"Reform {reform.id} apply_fn should be callable"
        )


def test_reform_definition_has_required_fields():
    """Test that ReformDefinition dataclass has all required fields."""
    from scottish_budget_data.reforms import ReformDefinition

    def dummy_apply(sim):
        pass

    reform = ReformDefinition(
        id="test",
        name="Test Reform",
        description="A test reform",
        apply_fn=dummy_apply,
    )

    assert reform.id == "test"
    assert reform.name == "Test Reform"
    assert reform.description == "A test reform"
    assert reform.apply_fn == dummy_apply


def test_income_tax_thresholds_match_budget():
    """Test that income tax thresholds match Scottish Budget 2026-27 values.

    Source: Scottish Income Tax 2026-27 Technical Factsheet, Table 1
    https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/
    """
    from scottish_budget_data.reforms import (
        INCOME_TAX_BASIC_THRESHOLD_2026,
        INCOME_TAX_INTERMEDIATE_THRESHOLD_2026,
    )

    # Thresholds are stored as amounts above personal allowance (£12,570)
    # Basic rate starts at £16,538 total → £3,968 above PA
    # Intermediate rate starts at £29,527 total → £16,957 above PA
    PERSONAL_ALLOWANCE = 12_570

    assert INCOME_TAX_BASIC_THRESHOLD_2026 == 3_968
    assert INCOME_TAX_BASIC_THRESHOLD_2026 + PERSONAL_ALLOWANCE == 16_538

    assert INCOME_TAX_INTERMEDIATE_THRESHOLD_2026 == 16_957
    assert INCOME_TAX_INTERMEDIATE_THRESHOLD_2026 + PERSONAL_ALLOWANCE == 29_527


def test_scp_premium_amount():
    """Test that SCP premium amount matches Scottish Budget 2026-27."""
    from scottish_budget_data.reforms import SCP_PREMIUM_UNDER_ONE_AMOUNT

    # £40/week for children under 1
    assert SCP_PREMIUM_UNDER_ONE_AMOUNT == 40


def test_scp_inflation_rate():
    """Test that SCP inflation rate matches Scottish Budget 2026-27.

    Source: Scottish Budget 2026-27
    https://www.gov.scot/news/a-budget-to-tackle-child-poverty/
    """
    from scottish_budget_data.reforms import SCP_BASELINE_RATE, SCP_INFLATION_RATE

    # £27.15/week baseline → £28.20/week inflation-adjusted (+3.9%)
    assert SCP_BASELINE_RATE == 27.15
    assert SCP_INFLATION_RATE == 28.20
    # Verify the increase is approximately 3.9%
    increase_pct = (SCP_INFLATION_RATE - SCP_BASELINE_RATE) / SCP_BASELINE_RATE * 100
    assert 3.8 < increase_pct < 4.0
