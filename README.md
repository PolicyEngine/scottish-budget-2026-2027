# Post-Scottish Budget 2026 Dashboard

**Live Dashboard:** [post-scottish-budget-dashboard.vercel.app](https://post-scottish-budget-dashboard.vercel.app)

An interactive dashboard analysing the impact of the Scottish Budget 2026–27 on living standards, poverty, and local areas across Scotland. Built by [PolicyEngine](https://policyengine.org).

## Overview

This dashboard examines how the budget measures announced by Finance Secretary Shona Robison on 13 January 2026 affect:

- **Living Standards** — Household income projections comparing pre-budget forecasts with post-budget impacts
- **Poverty** — Changes in poverty rates (absolute/relative, before/after housing costs) by age group
- **Local Areas** — Constituency-level impacts across Scotland's 57 Westminster constituencies

## Features

- Interactive D3.js line charts with historical data and PolicyEngine projections
- Toggle between nominal and real (inflation-adjusted) values
- Filter poverty data by type (absolute/relative, BHC/AHC) and age group
- Constituency selector with regional filtering
- Regional comparison charts showing average household gains
- Responsive design following PolicyEngine's design system

## Tech Stack

- React 19
- Vite
- D3.js (custom line charts)
- Recharts (bar charts)
- Vercel (deployment)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Data Sources

- **Historical data**: ONS Gross Disposable Household Income, Scottish Government poverty statistics
- **Projections**: PolicyEngine UK microsimulation model with Family Resources Survey data reweighted to Scottish constituencies

## Related

- [Pre-Scottish Budget Dashboard](https://policyengine.org/uk/scottish-budget-2026)
- [PolicyEngine UK](https://policyengine.org/uk)
- [UK Poverty Analysis Methodology](https://policyengine.org/uk/research/uk-poverty-analysis)

## License

MIT
