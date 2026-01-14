"""Simple test to verify both weight calculation methods are mathematically equivalent.

This tests the core calculation logic without needing to run full simulations.
"""

import numpy as np
import pandas as pd
from microdf import MicroSeries


def test_weight_methods():
    """Test that manual weights and MicroSeries.sum() give same results."""
    print("Testing weight calculation methods...")
    print("=" * 70)

    # Create dummy data representing households
    n_households = 1000
    np.random.seed(42)

    baseline_income = np.random.uniform(10000, 50000, n_households)
    income_change = np.random.uniform(-1000, 2000, n_households)
    reformed_income = baseline_income + income_change
    household_weight = np.random.uniform(500, 1500, n_households)

    # Filter to "Scotland" (simulate filtering)
    is_scotland = np.random.rand(n_households) < 0.1  # ~10% are Scottish
    n_scottish = is_scotland.sum()

    print(f"\nTotal households: {n_households}")
    print(f"Scottish households: {n_scottish}")
    print(f"Average change: £{income_change.mean():.2f}")

    print("\n" + "=" * 70)
    print("METHOD 1: Manual weight multiplication (current approach)")
    print("=" * 70)

    # Method 1: Extract to numpy, filter, manually multiply weights
    baseline_np = baseline_income[is_scotland]
    reformed_np = reformed_income[is_scotland]
    weights_np = household_weight[is_scotland]

    cost_method1 = ((reformed_np - baseline_np) * weights_np).sum()

    print(f"Scottish baseline income sum: £{(baseline_np * weights_np).sum():,.0f}")
    print(f"Scottish reformed income sum: £{(reformed_np * weights_np).sum():,.0f}")
    print(f"Total cost (manual): £{cost_method1:,.0f}")

    print("\n" + "=" * 70)
    print("METHOD 2: MicroSeries with built-in weights (Max's approach)")
    print("=" * 70)

    # Method 2: Use MicroSeries which handles weights automatically
    baseline_ms = MicroSeries(baseline_income, weights=household_weight)
    reformed_ms = MicroSeries(reformed_income, weights=household_weight)

    # Filter to Scotland (preserves MicroSeries with weights)
    baseline_scotland = baseline_ms[is_scotland]
    reformed_scotland = reformed_ms[is_scotland]

    # Use built-in weighted sum
    cost_method2 = (reformed_scotland - baseline_scotland).sum()

    print(f"Scottish baseline income sum: £{baseline_scotland.sum():,.0f}")
    print(f"Scottish reformed income sum: £{reformed_scotland.sum():,.0f}")
    print(f"Total cost (MicroSeries): £{cost_method2:,.0f}")

    print("\n" + "=" * 70)
    print("COMPARISON")
    print("=" * 70)

    difference = abs(cost_method1 - cost_method2)
    pct_diff = (difference / cost_method1) * 100 if cost_method1 != 0 else 0

    print(f"Method 1 (manual):      £{cost_method1:,.2f}")
    print(f"Method 2 (MicroSeries): £{cost_method2:,.2f}")
    print(f"Difference:             £{difference:,.2f} ({pct_diff:.10f}%)")

    if difference < 0.01:  # Less than 1 penny
        print("\n✅ PASS: Methods are mathematically equivalent!")
        print("Both approaches give the same result.")
        return True
    else:
        print(f"\n❌ FAIL: Methods differ by £{difference:.2f}")
        print("There is a calculation difference between the methods.")
        return False


def test_why_microseries_is_better():
    """Demonstrate why MicroSeries is the preferred approach."""
    print("\n" + "=" * 70)
    print("WHY MICROSERIES IS BETTER")
    print("=" * 70)

    n = 5
    values = np.array([100, 200, 300, 400, 500])
    weights = np.array([1.0, 2.0, 1.5, 0.5, 3.0])

    print("\nExample data:")
    print(f"Values:  {values}")
    print(f"Weights: {weights}")

    # Manual approach
    print("\nManual approach:")
    manual_sum = (values * weights).sum()
    print(f"  (values * weights).sum() = {manual_sum}")
    print("  Requires: 1) Extract weights, 2) Multiply, 3) Sum")

    # MicroSeries approach
    print("\nMicroSeries approach:")
    ms = MicroSeries(values, weights=weights)
    ms_sum = ms.sum()
    print(f"  MicroSeries(values, weights).sum() = {ms_sum}")
    print("  Requires: 1) Sum (weights handled automatically)")

    assert abs(manual_sum - ms_sum) < 0.01, "Methods should match!"

    print("\n✅ Both give same result, but MicroSeries is:")
    print("  • More concise (fewer lines of code)")
    print("  • Less error-prone (can't use wrong weights)")
    print("  • Follows PolicyEngine conventions")
    print("  • Automatically handles filtering/indexing correctly")


if __name__ == "__main__":
    success = test_weight_methods()
    test_why_microseries_is_better()

    if success:
        print("\n" + "=" * 70)
        print("CONCLUSION")
        print("=" * 70)
        print("Both methods are mathematically correct and give identical results.")
        print("However, MicroSeries.sum() is the preferred approach because:")
        print("  1. It's more concise")
        print("  2. It's less error-prone")
        print("  3. It follows PolicyEngine conventions")
        print("  4. Max Ghenis recommends it")
        print("\nYour current calculations are CORRECT, but consider updating")
        print("to use MicroSeries.sum() for cleaner, more maintainable code.")
