/**
 * Policy configuration for Scottish Budget dashboard.
 *
 * Color scheme follows autumn budget pattern:
 * - Teal/green spectrum: policies that are GOOD for households (costs to treasury)
 * - All Scottish Budget policies are costs to treasury, so all use teal spectrum
 */

// Policy colors by display name - teal spectrum from darkest (bottom/largest) to lightest (top/smallest)
export const POLICY_COLORS = {
  "Income tax threshold uplift": "#0D9488",   // Teal 600 (darkest - largest, bottom)
  "SCP inflation adjustment": "#14B8A6",      // Teal 500 (medium)
  "SCP Premium for under-ones": "#2DD4BF",    // Teal 400 (lightest - smallest, top)
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

// Order: bottom to top in stacked chart (largest to smallest)
export const ALL_POLICY_IDS = ["income_tax_threshold_uplift", "scp_inflation", "scp_baby_boost"];

export const ALL_POLICY_NAMES = ["Income tax threshold uplift", "SCP inflation adjustment", "SCP Premium for under-ones"];
