/**
 * Scottish Budget 2026-27 reform configuration.
 */

// Backend API URL - Modal deployment
export const API_BASE_URL = import.meta.env.VITE_API_URL || "https://policyengine--scottish-budget-api-flask-app.modal.run";

/**
 * Reform metadata for UI display.
 * Includes both household-positive (uplifts, SCP) and household-negative (freezes) reforms.
 */
export const REFORMS = [
  // Income tax threshold uplifts (benefit households)
  {
    id: "income_tax_basic_uplift",
    name: "Basic rate threshold uplift",
    description: "Basic rate threshold raised from £15,398 to £16,538 (+7.4%)",
    color: "#0D9488",  // Teal 600
    type: "positive",
  },
  {
    id: "income_tax_intermediate_uplift",
    name: "Intermediate rate threshold uplift",
    description: "Intermediate rate threshold raised from £27,492 to £29,527 (+7.4%)",
    color: "#0F766E",  // Teal 700
    type: "positive",
  },
  // Income tax threshold freezes (cost households - revenue raising)
  {
    id: "higher_rate_freeze",
    name: "Higher rate threshold freeze",
    description: "Higher rate threshold frozen at £43,662 until 2028-29",
    color: "#78350F",  // Amber 900
    type: "negative",
  },
  {
    id: "advanced_rate_freeze",
    name: "Advanced rate threshold freeze",
    description: "Advanced rate threshold frozen at £75,000 until 2028-29",
    color: "#92400E",  // Amber 800
    type: "negative",
  },
  {
    id: "top_rate_freeze",
    name: "Top rate threshold freeze",
    description: "Top rate threshold frozen at £125,140 until 2028-29",
    color: "#B45309",  // Amber 700
    type: "negative",
  },
  // Scottish Child Payment
  {
    id: "scp_baby_boost",
    name: "SCP Premium for under-ones",
    description: "Scottish Child Payment raised to £40/week for babies under 1",
    color: "#2DD4BF",  // Teal 400
    type: "positive",
  },
];
