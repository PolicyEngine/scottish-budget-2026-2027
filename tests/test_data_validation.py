"""Tests to validate generated dashboard data."""

import pandas as pd
import pytest
from pathlib import Path


DATA_DIR = Path(__file__).parent.parent / "public" / "data"


@pytest.fixture
def budgetary_impact():
    """Load budgetary impact data."""
    return pd.read_csv(DATA_DIR / "budgetary_impact.csv")


@pytest.fixture
def distributional_impact():
    """Load distributional impact data."""
    return pd.read_csv(DATA_DIR / "distributional_impact.csv")


@pytest.fixture
def winners_losers():
    """Load winners/losers data."""
    return pd.read_csv(DATA_DIR / "winners_losers.csv")


@pytest.fixture
def metrics():
    """Load metrics data."""
    return pd.read_csv(DATA_DIR / "metrics.csv")


def test_budgetary_impact_has_required_columns(budgetary_impact):
    """Test that budgetary impact CSV has required columns."""
    required_cols = {"reform_id", "reform_name", "year", "value"}
    assert required_cols.issubset(set(budgetary_impact.columns))


def test_budgetary_impact_has_all_reforms(budgetary_impact):
    """Test that budgetary impact includes all four reforms."""
    reform_ids = set(budgetary_impact["reform_id"].unique())
    expected = {"combined", "scp_inflation", "scp_baby_boost", "income_tax_threshold_uplift"}
    assert reform_ids == expected


def test_budgetary_impact_has_all_years(budgetary_impact):
    """Test that budgetary impact covers 2026-2030."""
    years = set(budgetary_impact["year"].unique())
    expected = {2026, 2027, 2028, 2029, 2030}
    assert years == expected


def test_scp_inflation_cost_in_expected_range(budgetary_impact):
    """Test SCP inflation adjustment cost is in expected range (£10-25M for 2026).

    Based on PolicyEngine microsimulation of:
    - SCP-eligible children in Scotland
    - £1.05/week increase (£27.15 → £28.20)
    - Annual per child: £1.05 × 52 = £54.60
    """
    scp_inflation_2026 = budgetary_impact[
        (budgetary_impact["reform_id"] == "scp_inflation")
        & (budgetary_impact["year"] == 2026)
    ]["value"].iloc[0]

    assert 10 < scp_inflation_2026 < 25, f"SCP inflation cost £{scp_inflation_2026:.1f}M outside expected range"


def test_scp_baby_boost_cost_in_expected_range(budgetary_impact):
    """Test SCP baby boost cost is in expected range (£10-25M for 2026).

    Based on validation analysis:
    - UC proxy: ~24,099 eligible babies → £16.1M at 100% take-up
    - SCP take-up (~88%): ~21,258 eligible → £14.2M (our estimate)
    - Government estimate (57% take-up): 12,000 → £8M
    """
    scp_2026 = budgetary_impact[
        (budgetary_impact["reform_id"] == "scp_baby_boost")
        & (budgetary_impact["year"] == 2026)
    ]["value"].iloc[0]

    # Should be between government low estimate and UC proxy upper bound
    assert 8 < scp_2026 < 25, f"SCP baby boost cost £{scp_2026:.1f}M outside expected range"


def test_income_tax_uplift_cost_in_expected_range(budgetary_impact):
    """Test income tax uplift cost is in expected range (£50-70M for 2026).

    Based on validation analysis:
    - IFS estimate: £52M
    - Our estimate: £61.7M (+19%)
    """
    tax_2026 = budgetary_impact[
        (budgetary_impact["reform_id"] == "income_tax_threshold_uplift")
        & (budgetary_impact["year"] == 2026)
    ]["value"].iloc[0]

    assert 50 < tax_2026 < 70, f"Income tax uplift cost £{tax_2026:.1f}M outside expected range"


def test_combined_is_sum_of_individual_reforms(budgetary_impact):
    """Test combined reform cost approximately equals sum of individual reforms.

    Note: May not be exactly additive due to interaction effects.
    """
    for year in [2026, 2027, 2028, 2029, 2030]:
        combined = budgetary_impact[
            (budgetary_impact["reform_id"] == "combined")
            & (budgetary_impact["year"] == year)
        ]["value"].iloc[0]

        scp_inflation = budgetary_impact[
            (budgetary_impact["reform_id"] == "scp_inflation")
            & (budgetary_impact["year"] == year)
        ]["value"].iloc[0]

        scp_baby_boost = budgetary_impact[
            (budgetary_impact["reform_id"] == "scp_baby_boost")
            & (budgetary_impact["year"] == year)
        ]["value"].iloc[0]

        tax = budgetary_impact[
            (budgetary_impact["reform_id"] == "income_tax_threshold_uplift")
            & (budgetary_impact["year"] == year)
        ]["value"].iloc[0]

        individual_sum = scp_inflation + scp_baby_boost + tax
        # Allow 5% difference due to interaction effects
        assert abs(combined - individual_sum) / individual_sum < 0.05, (
            f"Year {year}: Combined (£{combined:.1f}M) differs from sum "
            f"(£{individual_sum:.1f}M) by more than 5%"
        )


def test_distributional_impact_has_all_deciles(distributional_impact):
    """Test distributional impact includes all income deciles plus All."""
    deciles = set(distributional_impact["decile"].unique())
    expected = {"1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "All"}
    assert deciles == expected


def test_winners_losers_percentages_sum_to_100(winners_losers):
    """Test winners/losers percentages sum to approximately 100%."""
    # Data format: metric column has winners_pct, losers_pct, unchanged_pct
    for (reform_id, year), group in winners_losers.groupby(["reform_id", "year"]):
        # Pivot to get percentages as columns
        metrics = group.set_index("metric")["value"]
        total = metrics.get("winners_pct", 0) + metrics.get("losers_pct", 0) + metrics.get("unchanged_pct", 0)
        assert 99 < total < 101, f"Reform {reform_id} year {year}: percentages sum to {total}%, not ~100%"


def test_all_data_files_exist():
    """Test that all expected data files exist."""
    expected_files = [
        "budgetary_impact.csv",
        "constituency.csv",
        "distributional_impact.csv",
        "metrics.csv",
        "winners_losers.csv",
    ]

    for filename in expected_files:
        filepath = DATA_DIR / filename
        assert filepath.exists(), f"Missing data file: {filename}"
