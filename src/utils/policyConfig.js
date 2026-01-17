/**
 * Policy configuration for Scottish Budget dashboard.
 *
 * Color scheme follows autumn budget pattern:
 * - Teal/green spectrum: policies that are GOOD for households (costs to treasury)
 * - All Scottish Budget policies are costs to treasury, so all use teal spectrum
 */

// Policy colors by display name - teal spectrum from darkest to lightest
export const POLICY_COLORS = {
  "SCP inflation adjustment": "#0D9488",      // Teal 600 (darkest - base SCP)
  "SCP Premium for under-ones": "#14B8A6",    // Teal 500 (medium - baby boost)
  "Income tax threshold uplift": "#2DD4BF",   // Teal 400 (lightest - tax relief)
};

export const POLICY_IDS = {
  scp_inflation: "scp_inflation",
  scp_baby_boost: "scp_baby_boost",
  income_tax_threshold_uplift: "income_tax_threshold_uplift",
};

export const POLICY_NAMES = {
  scp_inflation: "SCP inflation adjustment",
  scp_baby_boost: "SCP Premium for under-ones",
  income_tax_threshold_uplift: "Income tax threshold uplift",
};

// Order: bottom to top in stacked chart
export const ALL_POLICY_IDS = ["scp_inflation", "scp_baby_boost", "income_tax_threshold_uplift"];

export const ALL_POLICY_NAMES = ["SCP inflation adjustment", "SCP Premium for under-ones", "Income tax threshold uplift"];
