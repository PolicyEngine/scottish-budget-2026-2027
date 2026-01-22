# Scottish Mansion Tax Analysis

Analysis of Scotland's proposed council tax reform for £1m+ properties (Scottish Budget 2026-27), estimated by Scottish Parliament constituency.

**Live map**: [policyengine.github.io/scotland-mansion-tax](https://policyengine.github.io/scotland-mansion-tax)

## Quick Start

```bash
pip install -e .
scotland-mansion-tax run
```

## Results

| Metric | Value | Source |
|--------|-------|--------|
| £1m+ property stock | 11,481 | Savills (2022) |
| Estimated revenue | £18.5m/year | Analysis |

*Note: Scotland has not announced rates. We use UK Budget 2025 rates as benchmark (£1,500 for £1m-£2m, £2,500 for £2m+). Finance Secretary estimated £16m.*

## How We Calculate

### Step 1: Total Revenue

```
Total Revenue = Stock × Average Rate
             = 11,481 × £1,607
             = £18.5m/year
```

- **Stock**: 11,481 properties worth £1m+ in Scotland (Savills 2022)
- **Average Rate**: (89% × £1,500) + (11% × £2,500) = £1,607/year
- **Band split**: 89%/11% from Savills 2024 (416 sales £1m-£2m, 50 sales £2m+)

### Step 2: Geographic Distribution

RoS Property Market Report 2024-25 provides council-level £1m+ sales. We use this only for geographic distribution, not revenue.

| Council | Sales | Share |
|---------|-------|-------|
| City of Edinburgh | 200 | 47% |
| East Lothian | 35 | 8% |
| Fife | 30 | 7% |
| Other councils | 164 | 38% |

### Step 3: Distribute Within Councils

Each council contains multiple constituencies. To allocate sales within a council, we use **Band H-adjusted weights**:

```
Weight = (Population × Band H Factor) / Council Total
```

### Step 4: Band H Factor

**What is Band H?** Council Tax Band H contains properties valued >£212k in 1991. Using UK House Price Index, Scottish prices have risen 4.98× since 1991, so Band H threshold today ≈ **£1.06 million**.

**What we measure**: The percentage of dwellings in each constituency that are Band H. This is a count of expensive properties, not a council tax rate.

```
Band H Factor = Constituency Band H % ÷ Scotland Average Band H %
```

Scotland average: 0.57% of dwellings are Band H (~16,000 out of ~2.8 million).

| Constituency | Band H % | Band H Factor |
|--------------|----------|---------------|
| Edinburgh Southern | 2.97% | 5.26× |
| Edinburgh Central | 2.74% | 4.85× |
| Scotland average | 0.57% | 1.00× |
| Glasgow Pollok | 0.00% | 0.00× |

**Why Band H?** It's the only publicly available data that approximates £1m+ property concentration at constituency level in Scotland. RoS charges for transaction data and only publishes council-level aggregates.

### Step 5: Allocate Revenue

```
Constituency Revenue = (Council Sales × Weight / Total Sales) × £18.5m
```

## Data Sources

| Data | Source |
|------|--------|
| £1m+ stock | Savills 2022 |
| £1m+ sales | RoS 2024-25 |
| Band H dwellings | NRS Dwelling Estimates 2023 |
| Population | NRS 2022 |
| Policy rates | UK Budget 2025 |

## Limitations

1. **Modeled estimates**: Constituency figures are estimates, not direct observations
2. **Band H as proxy**: Band H (>£212k in 1991 ≈ £1.06m today) approximates but doesn't perfectly match £1m+ threshold
3. **Rate uncertainty**: Scotland hasn't announced rates; actual revenue depends on rates chosen
4. **Stock-sales assumption**: Assumes stock distributed geographically like sales
