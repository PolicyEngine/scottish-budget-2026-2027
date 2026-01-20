"""Command-line interface for Scottish Budget Data generation."""

import argparse
import sys
from pathlib import Path

from scottish_budget_data.pipeline import generate_all_data
from scottish_budget_data.reforms import get_scottish_budget_reforms


def parse_args(args: list[str] = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        prog="scottish-budget-data",
        description="Generate data for Scottish Budget dashboard.",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("./public/data"),
        help="Output directory for CSV files (default: ./public/data)",
    )

    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        default=[2026, 2027, 2028, 2029, 2030],
        help="Years to calculate (default: 2026 2027 2028 2029 2030)",
    )

    parser.add_argument(
        "--list-reforms",
        action="store_true",
        help="List all available reform IDs and exit",
    )

    parser.add_argument(
        "--reform",
        type=str,
        nargs="+",
        help="Only run specific reform(s) by ID (e.g., --reform scp_baby_boost)",
    )

    return parser.parse_args(args)


def print_reforms_list() -> None:
    """Print a list of available reforms."""
    print("\nAvailable Reforms:")
    print("-" * 50)
    for reform in get_scottish_budget_reforms():
        print(f"  {reform.id}: {reform.name}")
    print()


def main(args: list[str] = None) -> int:
    """Main entry point for CLI."""
    parsed = parse_args(args)

    if parsed.list_reforms:
        print_reforms_list()
        return 0

    print("\n" + "=" * 50)
    print("Scottish Budget Data Generator")
    print("=" * 50)
    print(f"Output: {parsed.output_dir}")
    print(f"Years: {parsed.years}")

    all_reforms = get_scottish_budget_reforms()

    if parsed.reform:
        # Filter to only requested reforms
        reform_ids = set(parsed.reform)
        reforms = [r for r in all_reforms if r.id in reform_ids]
        # Check for invalid IDs
        valid_ids = {r.id for r in all_reforms}
        invalid_ids = reform_ids - valid_ids
        if invalid_ids:
            print(f"Error: Unknown reform ID(s): {', '.join(invalid_ids)}")
            print("Use --list-reforms to see available IDs")
            return 1
        print(f"Reforms: {len(reforms)} (filtered)")
    else:
        reforms = all_reforms
        print(f"Reforms: {len(reforms)}")
    print()

    try:
        generate_all_data(
            reforms=reforms,
            output_dir=parsed.output_dir,
            years=parsed.years,
        )
        print("\n" + "=" * 50)
        print("Data generation complete!")
        print("=" * 50 + "\n")
        return 0
    except FileNotFoundError as e:
        print(f"\nError: {e}")
        return 1
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        raise


if __name__ == "__main__":
    sys.exit(main())
