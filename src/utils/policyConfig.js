/**
 * Policy configuration for Scottish Budget dashboard.
 *
 * Color scheme follows autumn budget pattern:
 * - Teal/green spectrum: policies that are GOOD for households (costs to treasury)
 * - Amber/orange spectrum: policies that are BAD for households (revenue raisers)
 */

// Policy colors by display name
// Teal = costs to government (good for households)
// Amber = revenue raisers (bad for households)
export const POLICY_COLORS = {
  // COSTS to treasury (good for households - teal/green spectrum)
  "Basic rate threshold uplift": "#0D9488",   // Teal 600
  "Intermediate rate threshold uplift": "#0F766E", // Teal 700
  "SCP Premium for under-ones": "#2DD4BF",    // Teal 400

  // REVENUE raisers (bad for households - amber/orange spectrum)
  "Higher rate threshold freeze": "#78350F",   // Amber 900 (darkest)
  "Advanced rate threshold freeze": "#92400E", // Amber 800
  "Top rate threshold freeze": "#B45309",      // Amber 700
};

export const POLICY_IDS = {
  scp_baby_boost: "scp_baby_boost",
  income_tax_basic_uplift: "income_tax_basic_uplift",
  income_tax_intermediate_uplift: "income_tax_intermediate_uplift",
  higher_rate_freeze: "higher_rate_freeze",
  advanced_rate_freeze: "advanced_rate_freeze",
  top_rate_freeze: "top_rate_freeze",
};

export const POLICY_NAMES = {
  scp_baby_boost: "SCP Premium for under-ones",
  income_tax_basic_uplift: "Basic rate threshold uplift",
  income_tax_intermediate_uplift: "Intermediate rate threshold uplift",
  higher_rate_freeze: "Higher rate threshold freeze",
  advanced_rate_freeze: "Advanced rate threshold freeze",
  top_rate_freeze: "Top rate threshold freeze",
};

// Order for stacked charts: costs first (teal), then revenue raisers (amber)
// Within each category: largest to smallest
export const ALL_POLICY_IDS = [
  // Costs to treasury (negative, teal) - largest to smallest
  "income_tax_basic_uplift",
  "income_tax_intermediate_uplift",
  "scp_baby_boost",
  // Revenue raisers (positive, amber) - largest to smallest
  "higher_rate_freeze",
  "advanced_rate_freeze",
  "top_rate_freeze",
];

export const ALL_POLICY_NAMES = [
  "Basic rate threshold uplift",
  "Intermediate rate threshold uplift",
  "SCP Premium for under-ones",
  "Higher rate threshold freeze",
  "Advanced rate threshold freeze",
  "Top rate threshold freeze",
];

// Policies that are costs to treasury (negative values, good for households)
export const COST_POLICIES = [
  "scp_baby_boost",
  "income_tax_basic_uplift",
  "income_tax_intermediate_uplift",
];

// Policies that are revenue raisers (positive values, bad for households)
export const REVENUE_POLICIES = [
  "higher_rate_freeze",
  "advanced_rate_freeze",
  "top_rate_freeze",
];
