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


def test_all_reforms_have_reform_class():
    """Test that all reforms use proper PolicyEngine Reform classes."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms
    from policyengine_core.reforms import Reform as PEReform

    reforms = get_scottish_budget_reforms()
    for reform in reforms:
        assert reform.reform_class is not None, (
            f"Reform {reform.id} should have a reform_class"
        )
        assert issubclass(reform.reform_class, PEReform), (
            f"Reform {reform.id} should use a PolicyEngine Reform class"
        )


def test_reform_definition_has_required_fields():
    """Test that ReformDefinition dataclass has all required fields."""
    from scottish_budget_data.reforms import ReformDefinition, SCPBabyBoostReform

    reform = ReformDefinition(
        id="test",
        name="Test Reform",
        description="A test reform",
        reform_class=SCPBabyBoostReform,
    )

    assert reform.id == "test"
    assert reform.name == "Test Reform"
    assert reform.description == "A test reform"
    assert reform.reform_class == SCPBabyBoostReform


def test_income_tax_constants_are_reasonable():
    """Test that income tax constants have reasonable values."""
    from scottish_budget_data.reforms import (
        INCOME_TAX_BASIC_INCREASE,
        INCOME_TAX_INTERMEDIATE_INCREASE,
    )

    # Income tax threshold increases in £
    assert 500 < INCOME_TAX_BASIC_INCREASE < 2000  # ~£1,069
    assert 1000 < INCOME_TAX_INTERMEDIATE_INCREASE < 3000  # ~£1,665
