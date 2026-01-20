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
    id: "income_tax_basic_uplift",
    name: "Basic rate threshold +7.4%",
    description: "Basic rate (20%) threshold increased by 7.4%",
    color: "#0D9488",  // Teal 600 (darkest - largest)
  },
  {
    id: "income_tax_intermediate_uplift",
    name: "Intermediate rate threshold +7.4%",
    description: "Intermediate rate (21%) threshold increased by 7.4%",
    color: "#14B8A6",  // Teal 500 (medium)
  },
  {
    id: "scp_inflation",
    name: "SCP inflation adjustment (£28.20/week)",
    description: "SCP uprated from £27.15 to £28.20/week (+3.9%)",
    color: "#2DD4BF",  // Teal 400 (lightest)
  },
  {
    id: "scp_baby_boost",
    name: "SCP Premium for under-ones (£40/week)",
    description: "Extra £11.15/week for babies under 1 (from 2027)",
    color: "#5EEAD4",  // Teal 300 (lightest - smallest)
  },
];
