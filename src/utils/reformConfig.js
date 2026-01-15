/**
 * Scottish Budget 2026-27 reform configuration.
 */

// Backend API URL - Modal deployment
export const API_BASE_URL = import.meta.env.VITE_API_URL || "https://policyengine--scottish-budget-api-flask-app.modal.run";

/**
 * Reform metadata for UI display.
 */
export const REFORMS = [
  {
    id: "scp_baby_boost",
    name: "SCP Premium for under-ones (£40/week)",
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
