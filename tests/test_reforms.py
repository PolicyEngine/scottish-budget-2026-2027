"""Tests for Scottish Budget reform definitions."""

import pytest


def test_get_scottish_budget_reforms_returns_three_reforms():
    """Test that get_scottish_budget_reforms returns exactly 3 reforms."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms

    reforms = get_scottish_budget_reforms()
    assert len(reforms) == 3


def test_reform_ids():
    """Test that reforms have expected IDs."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms

    reforms = get_scottish_budget_reforms()
    reform_ids = {r.id for r in reforms}

    expected_ids = {"combined", "scp_baby_boost", "income_tax_threshold_uplift"}
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
        INCOME_TAX_BASIC_THRESHOLD,
        INCOME_TAX_INTERMEDIATE_THRESHOLD,
    )

    # Thresholds are stored as amounts above personal allowance (£12,570)
    # Basic rate starts at £16,537 total → £3,967 above PA
    # Intermediate rate starts at £29,526 total → £16,956 above PA
    PERSONAL_ALLOWANCE = 12_570

    assert INCOME_TAX_BASIC_THRESHOLD == 3_967
    assert INCOME_TAX_BASIC_THRESHOLD + PERSONAL_ALLOWANCE == 16_537

    assert INCOME_TAX_INTERMEDIATE_THRESHOLD == 16_956
    assert INCOME_TAX_INTERMEDIATE_THRESHOLD + PERSONAL_ALLOWANCE == 29_526


def test_scp_premium_amount():
    """Test that SCP premium amount matches Scottish Budget 2026-27."""
    from scottish_budget_data.reforms import SCP_PREMIUM_UNDER_ONE_AMOUNT

    # £40/week for children under 1
    assert SCP_PREMIUM_UNDER_ONE_AMOUNT == 40
