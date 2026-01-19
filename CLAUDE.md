# Scottish Budget 2026-2027 Dashboard

## Project context

Dashboard analyzing the Scottish Budget 2026-27 announced January 13, 2026. Compares PolicyEngine microsimulation estimates with Scottish Fiscal Commission (SFC) official costings.

## Key technical details

### Sign convention
**Matches autumn budget dashboard**:
- Negative = cost to government (spending increase or revenue loss)
- Positive = revenue for government (spending cut or revenue gain)

### Provisions modeled
From `src/scottish_budget_data/reforms.py`:
- `scp_inflation` - SCP uprated £27.15 → £28.20/week
- `scp_baby_boost` - £40/week for under-1s (starts April 2027)
- `income_tax_threshold_uplift` - Combined basic + intermediate 7.4% uplift
- `income_tax_basic_uplift` - Basic rate threshold only
- `income_tax_intermediate_uplift` - Intermediate rate threshold only
- `higher_rate_freeze` - Freeze at £43,662 (2027+ only, 2026 already in baseline)
- `advanced_rate_freeze` - Freeze at £62,430 (2027+ only)
- `top_rate_freeze` - Freeze at £125,140 (2027+ only)

### Costing methodology
Each provision is costed **independently against baseline** (not JCT-style stacking). This means the sum of individual provisions may not equal the combined total due to interactions.

## Known discrepancies with SFC

| Provision | Issue | Explanation |
|-----------|-------|-------------|
| Baby boost | PE £14m vs SFC £3m | SFC assumes 18-month rollout, so 2027-28 is only half-year |
| Higher rate freeze | PE £245m vs SFC £116m | Behavioral responses in SFC; possibly different baseline inflation |
| Advanced/top rate freeze | PE ~10-17x higher than SFC | Needs investigation (see beads issue PolicyEngine-2lo) |

## Dependencies

- **policyengine-uk PR #1486**: Adds 2026 baseline freeze for higher/advanced/top rates (announced in Budget 2025-26). Must be merged for accurate 2027+ freeze costings.

## Data sources

- SFC Table A.1: https://fiscalcommission.scot/wp-content/uploads/2026/01/Scotlands-Economic-and-Fiscal-Forecasts-January-2026-revised-13-01-2026.pdf#page=96
- Scottish Government announcement: https://www.gov.scot/news/a-budget-to-tackle-child-poverty/

## Running the project

```bash
# Generate data
uv run scottish-budget-data

# Start dev server
bun run dev
```
