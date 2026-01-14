/**
 * Scottish Budget 2026-27 reform configuration.
 */

// Local backend API (uses policyengine_uk directly)
export const API_BASE_URL = "http://localhost:5001";

/**
 * Reform metadata for UI display.
 */
export const REFORMS = [
  {
    id: "scp_baby_boost",
    name: "SCP baby boost (£40/week)",
    description: "Extra £12.85/week for babies under 1",
    color: "#2C6496",
  },
  {
    id: "income_tax_threshold_uplift",
    name: "Income tax threshold uplift (7.4%)",
    description: "7.4% increase in basic and intermediate thresholds",
    color: "#29AB87",
  },
];
