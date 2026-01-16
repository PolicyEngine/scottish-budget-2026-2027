import { useState, useEffect, useMemo } from "react";
import "./ValidationTab.css";

// Format difference with + for positive values
const formatDifference = (peValue, officialValue) => {
  if (peValue === null || peValue === undefined) return "—";
  const diff = ((peValue - officialValue) / officialValue * 100);
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(0)}%`;
};

// Format absolute difference with + for positive values
const formatAbsDifference = (peValue, officialValue) => {
  if (peValue === null || peValue === undefined) return "—";
  const diff = peValue - officialValue;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}pp`;
};

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");

  const parseLine = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    data.push(row);
  }
  return data;
}

// PolicyEngine data URLs
const PE_DATA_URLS = {
  baseline: "https://github.com/PolicyEngine/scottish-budget-dashboard/blob/main/public/data/scotland_baseline.csv",
  twoChildLimit: "https://github.com/PolicyEngine/scottish-budget-dashboard/blob/main/public/data/scotland_two_child_limit.csv",
};


// Official statistics data with sources
const OFFICIAL_STATS = {
  povertyBHC: {
    value: 18,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "3-year average",
  },
  povertyAHC: {
    value: 20,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "3-year average",
  },
  childPovertyBHC: {
    value: 20,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "Relative poverty",
  },
  childPovertyAHC: {
    value: 23,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "Relative poverty",
  },
  workingAgePovertyBHC: {
    value: 14,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "Relative poverty",
  },
  workingAgePovertyAHC: {
    value: 17,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "Relative poverty",
  },
  pensionerPovertyBHC: {
    value: 13,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "Relative poverty",
  },
  pensionerPovertyAHC: {
    value: 15,
    year: "2021–24",
    source: "Scottish Government",
    url: "https://data.gov.scot/poverty/",
    note: "Relative poverty",
  },
  medianIncome: {
    value: 29800,
    year: "2025–26",
    source: "Scottish Government",
    url: "https://www.gov.scot/publications/scottish-income-tax-2025-2026-factsheet/pages/2/",
    note: "Taxpayer income",
  },
  gdhiPerHead: {
    value: 22908,
    year: "2023",
    source: "ONS",
    url: "https://www.ons.gov.uk/economy/regionalaccounts/grossdisposablehouseholdincome/bulletins/regionalgrossdisposablehouseholdincomegdhi/1997to2023",
    note: "GDHI per head",
  },
  totalGDHI: {
    value: 125.8,
    year: "2023",
    source: "ONS",
    url: "https://www.ons.gov.uk/economy/regionalaccounts/grossdisposablehouseholdincome/bulletins/regionalgrossdisposablehouseholdincomegdhi/1997to2023",
    note: "Total £bn",
  },
  population: {
    value: 5.45,
    year: "2023",
    source: "NRS",
    url: "https://www.nrscotland.gov.uk/statistics-and-data/statistics/statistics-by-theme/population/population-estimates/mid-year-population-estimates/mid-2023",
    note: "Mid-year estimate (millions)",
  },
  households: {
    value: 2.53,
    year: "2023",
    source: "NRS",
    url: "https://www.nrscotland.gov.uk/statistics-and-data/statistics/statistics-by-theme/households/household-estimates/2023",
    note: "Household estimate (millions)",
  },
  childrenUnder16: {
    value: 0.90,
    year: "2023",
    source: "NRS",
    url: "https://www.nrscotland.gov.uk/publications/mid-2023-population-estimates/",
    note: "Children under 16 (millions)",
  },
  householdsWith3PlusChildren: {
    value: 82,
    year: "2022",
    source: "Census",
    url: "https://www.scotlandscensus.gov.uk/search-the-census#/location/topics/topic?topic=Household%20composition",
    note: "Households with 3+ children (thousands)",
  },
};

export default function ValidationTab() {
  const [loading, setLoading] = useState(true);
  const [baselineData, setBaselineData] = useState([]);

  // Load Scotland baseline data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load baseline data
        const response = await fetch("/data/scotland_baseline.csv");
        const csvText = await response.text();
        const parsed = parseCSV(csvText);

        // Transform data
        const data = parsed.map((row) => ({
          year: parseInt(row.year),
          meanIncome: parseFloat(row.mean_income_per_head),
          medianIncome: parseFloat(row.median_income_per_head),
          meanHouseholdIncome: parseFloat(row.mean_disposable_income),
          medianHouseholdIncome: parseFloat(row.median_disposable_income),
          medianTaxpayerIncome: parseFloat(row.median_taxpayer_income),
          taxpayerIncomeP25: parseFloat(row.taxpayer_income_p25),
          taxpayerIncomeP75: parseFloat(row.taxpayer_income_p75),
          meanIncomePerHead: parseFloat(row.mean_income_per_head),
          medianIncomePerHead: parseFloat(row.median_income_per_head),
          totalDisposableIncomeBn: parseFloat(row.total_disposable_income_bn),
          povertyBHC: parseFloat(row.poverty_rate_bhc),
          povertyAHC: parseFloat(row.poverty_rate_ahc),
          absolutePovertyBHC: parseFloat(row.absolute_poverty_bhc),
          absolutePovertyAHC: parseFloat(row.absolute_poverty_ahc),
          childPovertyBHC: parseFloat(row.child_poverty_bhc),
          childPovertyAHC: parseFloat(row.child_poverty_ahc),
          childAbsolutePoverty: parseFloat(row.child_absolute_poverty) || null,
          workingAgePovertyBHC: parseFloat(row.working_age_poverty_bhc),
          workingAgePovertyAHC: parseFloat(row.working_age_poverty_ahc),
          pensionerPovertyBHC: parseFloat(row.pensioner_poverty_bhc),
          pensionerPovertyAHC: parseFloat(row.pensioner_poverty_ahc),
          totalHouseholds: parseFloat(row.total_households),
          totalPopulation: parseFloat(row.total_population),
        }));

        setBaselineData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading Scotland data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Get PolicyEngine metrics for comparison
  // Use 2023 for poverty (to match official 2021-24 midpoint)
  // Use 2025 for income (to match official 2025-26)
  const peMetrics = useMemo(() => {
    if (baselineData.length === 0) return null;

    const year2023 = baselineData.find((d) => d.year === 2023);
    const year2025 = baselineData.find((d) => d.year === 2025);
    const year2026 = baselineData.find((d) => d.year === 2026);
    const latest = baselineData[baselineData.length - 1];

    return {
      year2023,
      year2025,
      year2026,
      latest,
    };
  }, [baselineData]);

  if (loading) {
    return (
      <div className="scotland-tab-loading">
        <div className="loading-spinner"></div>
        <p>Loading validation data...</p>
      </div>
    );
  }

  return (
    <div className="scotland-tab">
      {/* Validation Section */}
      <h2 className="section-title" id="validation">Validation</h2>
      <p className="chart-description">
        This section compares PolicyEngine estimates with official government statistics for
        population, income, and poverty.
      </p>

      {/* Population Table */}
      <h3 className="subsection-title">Population</h3>
      <div className="section-box">
        <p className="chart-description">
          The Family Resources Survey (FRS) samples approximately 20,000 UK households annually.
          PolicyEngine{" "}
          <a
            href="https://github.com/PolicyEngine/policyengine-uk-data/blob/main/policyengine_uk_data/datasets/local_areas/constituencies/calibrate.py"
            target="_blank"
            rel="noopener noreferrer"
          >
            reweights
          </a>{" "}
          the survey to match official demographic targets from the National Records of Scotland
          (NRS), including total population, household count, and age breakdowns. The table below
          compares PolicyEngine's calibrated estimates against 2023 mid-year estimates from NRS.
        </p>

        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Official</th>
                <th>PolicyEngine</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="metric-name">
                  <strong>Population</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.population.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.population.value}m
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${(peMetrics.year2023.totalPopulation / 1e6).toFixed(2)}m` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.totalPopulation / 1e6, OFFICIAL_STATS.population.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Households</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.households.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.households.value}m
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${(peMetrics.year2023.totalHouseholds / 1e6).toFixed(2)}m` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.totalHouseholds / 1e6, OFFICIAL_STATS.households.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Children under 16</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.childrenUnder16.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.childrenUnder16.value}m
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    0.97m
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(0.97, OFFICIAL_STATS.childrenUnder16.value)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Income Table */}
      <h3 className="subsection-title">Household income</h3>
      <div className="section-box">
        <p className="chart-description">
          Gross Disposable Household Income (GDHI) measures the amount of money households have
          available for spending or saving after taxes, benefits, pension contributions, and
          property income. ONS publishes GDHI for Scotland as part of regional accounts, derived
          from national accounts data and survey sources. PolicyEngine calculates household net income by simulating the full UK tax-benefit system
          for each FRS household, including employment and self-employment income, minus income tax and National
          Insurance, plus benefits such as Universal Credit, Child Benefit, and State Pension. The per-person
          figures divide total income by population; per-household figures divide by household count.
          Official median values are estimated at 87% of mean based on typical income distributions.
        </p>

        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Official</th>
                <th>PolicyEngine</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="metric-name">
                  <strong>Total</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.totalGDHI.url} target="_blank" rel="noopener noreferrer">
                    £{OFFICIAL_STATS.totalGDHI.value}bn
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `£${peMetrics.year2023.totalDisposableIncomeBn.toFixed(1)}bn` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.totalDisposableIncomeBn, OFFICIAL_STATS.totalGDHI.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Mean per person</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.gdhiPerHead.url} target="_blank" rel="noopener noreferrer">
                    £{OFFICIAL_STATS.gdhiPerHead.value.toLocaleString("en-GB")}
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `£${peMetrics.year2023.meanIncomePerHead.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.meanIncomePerHead, OFFICIAL_STATS.gdhiPerHead.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Median per person</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.gdhiPerHead.url} target="_blank" rel="noopener noreferrer">
                    £{Math.round(OFFICIAL_STATS.gdhiPerHead.value * 0.87).toLocaleString("en-GB")}
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `£${peMetrics.year2023.medianIncomePerHead.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.medianIncomePerHead, Math.round(OFFICIAL_STATS.gdhiPerHead.value * 0.87))}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Mean per household</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.totalGDHI.url} target="_blank" rel="noopener noreferrer">
                    £{Math.round((OFFICIAL_STATS.totalGDHI.value * 1e9) / (OFFICIAL_STATS.households.value * 1e6)).toLocaleString("en-GB")}
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `£${peMetrics.year2023.meanHouseholdIncome.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.meanHouseholdIncome, Math.round((OFFICIAL_STATS.totalGDHI.value * 1e9) / (OFFICIAL_STATS.households.value * 1e6)))}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Median per household</strong>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.totalGDHI.url} target="_blank" rel="noopener noreferrer">
                    £{Math.round((OFFICIAL_STATS.totalGDHI.value * 1e9) / (OFFICIAL_STATS.households.value * 1e6) * 0.87).toLocaleString("en-GB")}
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `£${peMetrics.year2023.medianHouseholdIncome.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                  </a>
                </td>
                <td className="difference">
                  {formatDifference(peMetrics?.year2023?.medianHouseholdIncome, Math.round((OFFICIAL_STATS.totalGDHI.value * 1e9) / (OFFICIAL_STATS.households.value * 1e6) * 0.87))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Poverty Rates Table */}
      <h3 className="subsection-title">Relative poverty rates</h3>
      <div className="section-box">
        <p className="chart-description">
          These comparisons use <strong>relative poverty</strong> (below 60% of current-year UK median income),
          which is the primary measure used in official Scottish Government statistics.
          The UK also measures <strong>absolute poverty</strong> (below 60% of 2010-11 median, adjusted for inflation),
          which PolicyEngine calculates but isn't compared here due to limited official breakdowns.
          Equivalisation adjusts for household size using the modified OECD scale (1.0 for
          the first adult, 0.5 for additional adults, 0.3 for children). BHC (before housing costs)
          uses total net income; AHC (after housing costs) subtracts rent, mortgage interest, and
          other housing costs, which typically increases measured poverty rates. Official statistics
          from the Scottish Government combine three years of FRS data (2021–24) to produce more
          stable estimates with smaller confidence intervals. PolicyEngine uses single-year data
          reweighted to Scottish constituencies, which can show more year-to-year variation.
        </p>
        <p className="chart-description" style={{ marginTop: "12px" }}>
          PolicyEngine shows higher child poverty than official statistics (28% vs 20% BHC). This
          gap arises from two factors. First, different benefit take-up assumptions: PolicyEngine{" "}
          <a
            href="https://github.com/PolicyEngine/policyengine-uk-data/blob/main/policyengine_uk_data/parameters/take_up/universal_credit.yaml"
            target="_blank"
            rel="noopener noreferrer"
          >
            assumes
          </a>{" "}
          55% UC take-up at the margin to stochastically assign claiming behaviour, then calibrates weights to
          match official UC expenditure totals, while the Scottish Government uses{" "}
          <a
            href="https://www.gov.scot/publications/impact-of-withdrawing-emergency-benefit-measures/pages/annex-a-methodology/"
            target="_blank"
            rel="noopener noreferrer"
          >
            UKMOD
          </a>{" "}
          with 87% take-up. Lower take-up means fewer families are modelled as receiving benefits,
          resulting in lower incomes and higher measured poverty. Second, PolicyEngine calibrates
          to high-income households, which can shift the income distribution
          and affect poverty metrics.
        </p>

        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Official</th>
                <th>PolicyEngine</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="metric-name">
                  <strong>All people (BHC)</strong>
                  <span className="metric-subtitle">Before housing costs</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.povertyBHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.povertyBHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.povertyBHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.povertyBHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.povertyBHC, OFFICIAL_STATS.povertyBHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>All people (AHC)</strong>
                  <span className="metric-subtitle">After housing costs</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.povertyAHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.povertyAHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.povertyAHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.povertyAHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.povertyAHC, OFFICIAL_STATS.povertyAHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Children (BHC)</strong>
                  <span className="metric-subtitle">Under 18</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.childPovertyBHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.childPovertyBHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.childPovertyBHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.childPovertyBHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.childPovertyBHC, OFFICIAL_STATS.childPovertyBHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Children (AHC)</strong>
                  <span className="metric-subtitle">Under 18</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.childPovertyAHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.childPovertyAHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.childPovertyAHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.childPovertyAHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.childPovertyAHC, OFFICIAL_STATS.childPovertyAHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Working-age (BHC)</strong>
                  <span className="metric-subtitle">16-64</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.workingAgePovertyBHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.workingAgePovertyBHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.workingAgePovertyBHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.workingAgePovertyBHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.workingAgePovertyBHC, OFFICIAL_STATS.workingAgePovertyBHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Working-age (AHC)</strong>
                  <span className="metric-subtitle">16-64</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.workingAgePovertyAHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.workingAgePovertyAHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.workingAgePovertyAHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.workingAgePovertyAHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.workingAgePovertyAHC, OFFICIAL_STATS.workingAgePovertyAHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Pensioners (BHC)</strong>
                  <span className="metric-subtitle">65+</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.pensionerPovertyBHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.pensionerPovertyBHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.pensionerPovertyBHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.pensionerPovertyBHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.pensionerPovertyBHC, OFFICIAL_STATS.pensionerPovertyBHC.value)}
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Pensioners (AHC)</strong>
                  <span className="metric-subtitle">65+</span>
                </td>
                <td className="official-value">
                  <a href={OFFICIAL_STATS.pensionerPovertyAHC.url} target="_blank" rel="noopener noreferrer">
                    {OFFICIAL_STATS.pensionerPovertyAHC.value}%
                  </a>
                  <span className="value-year">{OFFICIAL_STATS.pensionerPovertyAHC.year}</span>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.baseline} target="_blank" rel="noopener noreferrer">
                    {peMetrics?.year2023 ? `${peMetrics.year2023.pensionerPovertyAHC.toFixed(1)}%` : "—"}
                  </a>
                  <span className="value-year">2023</span>
                </td>
                <td className="difference">
                  {formatAbsDifference(peMetrics?.year2023?.pensionerPovertyAHC, OFFICIAL_STATS.pensionerPovertyAHC.value)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-child limit Table */}
      <h3 className="subsection-title">Two-child limit: SFC vs PolicyEngine comparison</h3>
      <div className="section-box">
        <p className="chart-description">
          The Scottish Fiscal{" "}
          <a
            href="https://fiscalcommission.scot/mitigating-the-two-child-limit-and-the-scottish-budget/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Commission
          </a>{" "}
          (SFC) uses DWP administrative data on actual UC claimants, while PolicyEngine uses Family
          Resources Survey data{" "}
          <a
            href="https://github.com/PolicyEngine/policyengine-uk-data/blob/main/policyengine_uk_data/datasets/local_areas/constituencies/calibrate.py"
            target="_blank"
            rel="noopener noreferrer"
          >
            reweighted
          </a>{" "}
          to Scotland. PolicyEngine estimates more families with three or more children receiving UC,
          resulting in higher cost and beneficiary estimates.
        </p>

        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>SFC</th>
                <th>PolicyEngine</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="metric-name">
                  <strong>Cost 2026–27</strong>
                </td>
                <td className="official-value">
                  <a href="https://fiscalcommission.scot/mitigating-the-two-child-limit-and-the-scottish-budget/" target="_blank" rel="noopener noreferrer">
                    £155m
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.twoChildLimit} target="_blank" rel="noopener noreferrer">
                    £213m
                  </a>
                </td>
                <td className="difference">
                  +37%
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Cost 2029–30</strong>
                </td>
                <td className="official-value">
                  <a href="https://fiscalcommission.scot/mitigating-the-two-child-limit-and-the-scottish-budget/" target="_blank" rel="noopener noreferrer">
                    £198m
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.twoChildLimit} target="_blank" rel="noopener noreferrer">
                    £256m
                  </a>
                </td>
                <td className="difference">
                  +29%
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Children affected 2026–27</strong>
                </td>
                <td className="official-value">
                  <a href="https://fiscalcommission.scot/mitigating-the-two-child-limit-and-the-scottish-budget/" target="_blank" rel="noopener noreferrer">
                    43,000
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.twoChildLimit} target="_blank" rel="noopener noreferrer">
                    69,000
                  </a>
                </td>
                <td className="difference">
                  +60%
                </td>
              </tr>
              <tr>
                <td className="metric-name">
                  <strong>Children affected 2029–30</strong>
                </td>
                <td className="official-value">
                  <a href="https://fiscalcommission.scot/mitigating-the-two-child-limit-and-the-scottish-budget/" target="_blank" rel="noopener noreferrer">
                    50,000
                  </a>
                </td>
                <td className="pe-value">
                  <a href={PE_DATA_URLS.twoChildLimit} target="_blank" rel="noopener noreferrer">
                    73,000
                  </a>
                </td>
                <td className="difference">
                  +46%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
