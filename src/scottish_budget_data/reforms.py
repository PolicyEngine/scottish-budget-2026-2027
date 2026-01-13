"""Scottish Budget 2026-27 reform definitions.

This module defines the policy reforms for the Scottish Budget analysis.
"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class Reform:
    """A policy reform definition."""

    id: str
    name: str
    description: str
    parameter_changes: dict = field(default_factory=dict)
    baseline_parameter_changes: Optional[dict] = None

    def to_scenario(self):
        """Convert to PolicyEngine Scenario."""
        from policyengine_uk import Scenario

        if not self.parameter_changes:
            return None
        return Scenario(parameter_changes=self.parameter_changes)

    def to_baseline_scenario(self):
        """Convert baseline changes to PolicyEngine Scenario."""
        from policyengine_uk import Scenario

        if not self.baseline_parameter_changes:
            return None
        return Scenario(parameter_changes=self.baseline_parameter_changes)


def get_scottish_budget_reforms() -> list[Reform]:
    """Get list of Scottish Budget 2026-27 reforms.

    Returns:
        List of Reform objects for analysis.
    """
    reforms = []

    # Two-child limit abolition (Scotland top-up to fully offset)
    # This effectively removes the two-child limit for Scottish households
    reforms.append(
        Reform(
            id="two_child_limit_abolition",
            name="Two-child limit abolition",
            description="Abolish the two-child limit on benefits for Scottish households",
            parameter_changes={
                "gov.dwp.universal_credit.elements.child.limit.child_count": {
                    "2026-01-01": float("inf"),
                },
                "gov.dwp.tax_credits.child_tax_credit.limit.child_count": {
                    "2026-01-01": float("inf"),
                },
            },
        )
    )

    # Combined Scottish Budget (all measures)
    reforms.append(
        Reform(
            id="scottish_budget_2026_combined",
            name="Scottish Budget 2026 (combined)",
            description="All Scottish Budget 2026-27 measures combined",
            parameter_changes={
                "gov.dwp.universal_credit.elements.child.limit.child_count": {
                    "2026-01-01": float("inf"),
                },
                "gov.dwp.tax_credits.child_tax_credit.limit.child_count": {
                    "2026-01-01": float("inf"),
                },
            },
        )
    )

    return reforms


# Policy metadata for dashboard
POLICIES = [
    {
        "id": "two_child_limit_abolition",
        "name": "Two-child limit abolition",
        "description": "Abolish the two-child limit on benefits",
        "explanation": """
            The two-child limit restricts Universal Credit and Child Tax Credit payments
            to a maximum of two children per family. The Scottish Government's top-up
            payment effectively abolishes this limit for Scottish households, allowing
            families to receive full child-related benefit payments for all children.
        """,
    },
]

PRESETS = [
    {
        "id": "scottish-budget-2026",
        "name": "Scottish Budget 2026",
        "policies": ["two_child_limit_abolition"],
    },
]
