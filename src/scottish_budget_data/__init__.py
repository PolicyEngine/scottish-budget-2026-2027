"""Scottish Budget data generation package."""

# Lazy imports to avoid loading policyengine_uk on module import
__all__ = ["generate_all_data", "get_scottish_budget_reforms"]


def get_scottish_budget_reforms():
    """Get Scottish Budget reforms (lazy import)."""
    from scottish_budget_data.reforms import get_scottish_budget_reforms
    return get_scottish_budget_reforms()


def generate_all_data():
    """Generate all data (lazy import)."""
    from scottish_budget_data.pipeline import generate_all_data
    return generate_all_data()
