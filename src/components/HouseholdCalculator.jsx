import { useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import "./HouseholdCalculator.css";

// Scottish Budget 2026-27 reforms configuration
const REFORMS = [
  {
    key: "scp_baby_boost",
    label: "SCP baby boost",
    color: "#2C6496", // PolicyEngine blue
    description: "Extra £12.85/week for babies under 1",
  },
  {
    key: "income_tax_threshold",
    label: "Income tax threshold uplift",
    color: "#29AB87", // PolicyEngine green
    description: "7.4% increase in basic and intermediate thresholds",
  },
];

// Scottish income tax bands 2025-26 (baseline)
const BASELINE_BANDS = {
  personalAllowance: 12571,
  starterRate: { threshold: 14876, rate: 0.19 }, // £12,571 - £14,876
  basicRate: { threshold: 26561, rate: 0.20 }, // £14,877 - £26,561 (£2,305 + £12,571)
  intermediateRate: { threshold: 43662, rate: 0.21 }, // £26,562 - £43,662 (£14,921 + £12,571)
  higherRate: { threshold: 75000, rate: 0.42 }, // £43,663 - £75,000
  advancedRate: { threshold: 125140, rate: 0.45 }, // £75,001 - £125,140
  topRate: { threshold: Infinity, rate: 0.48 }, // Over £125,140
};

// Reformed bands (7.4% uplift on basic and intermediate thresholds)
const REFORMED_BANDS = {
  ...BASELINE_BANDS,
  basicRate: { threshold: 29527, rate: 0.20 }, // £16,537 - £12,571 = £3,966 above PA, absolute = £29,527
  intermediateRate: { threshold: 43662, rate: 0.21 }, // Higher rate unchanged at £43,663
};

// SCP eligibility constants
const SCP_WEEKLY_STANDARD = 27.15;
const SCP_WEEKLY_BABY = 40.0;
const SCP_BABY_BOOST = (SCP_WEEKLY_BABY - SCP_WEEKLY_STANDARD) * 52; // £668.20/year

// Income threshold for SCP eligibility (approximate - based on UC eligibility)
const SCP_INCOME_THRESHOLD = 35000; // Approximate max household income for UC eligibility

// Default input values
const DEFAULT_INPUTS = {
  employment_income: 30000,
  is_married: false,
  partner_income: 0,
  children_ages: [],
};

// Slider configurations
const SLIDER_CONFIGS = [
  {
    id: "employment_income",
    label: "Your annual employment income",
    min: 0,
    max: 150000,
    step: 1000,
    format: (v) => `£${d3.format(",.0f")(v)}`,
  },
];

function HouseholdCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [childAgeInput, setChildAgeInput] = useState("");

  // Handle input change
  const handleInputChange = useCallback((id, value) => {
    setInputs((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  // Add child
  const addChild = useCallback(() => {
    const age = parseInt(childAgeInput);
    if (!isNaN(age) && age >= 0 && age <= 18) {
      setInputs((prev) => ({
        ...prev,
        children_ages: [...prev.children_ages, age].sort((a, b) => a - b),
      }));
      setChildAgeInput("");
    }
  }, [childAgeInput]);

  // Remove child
  const removeChild = useCallback((index) => {
    setInputs((prev) => ({
      ...prev,
      children_ages: prev.children_ages.filter((_, i) => i !== index),
    }));
  }, []);

  // Calculate Scottish income tax
  const calculateScottishTax = useCallback((income, bands) => {
    if (income <= bands.personalAllowance) return 0;

    let tax = 0;
    let remainingIncome = income;

    // Personal allowance tapering (above £100k)
    let effectivePA = bands.personalAllowance;
    if (income > 100000) {
      const reduction = Math.min(effectivePA, (income - 100000) * 0.5);
      effectivePA = Math.max(0, effectivePA - reduction);
    }

    remainingIncome -= effectivePA;

    // Starter rate (19%)
    const starterBand = Math.min(
      remainingIncome,
      bands.starterRate.threshold - bands.personalAllowance
    );
    if (starterBand > 0) {
      tax += starterBand * bands.starterRate.rate;
      remainingIncome -= starterBand;
    }

    // Basic rate (20%)
    const basicBand = Math.min(
      remainingIncome,
      bands.basicRate.threshold - bands.starterRate.threshold
    );
    if (basicBand > 0) {
      tax += basicBand * bands.basicRate.rate;
      remainingIncome -= basicBand;
    }

    // Intermediate rate (21%)
    const intermediateBand = Math.min(
      remainingIncome,
      bands.intermediateRate.threshold - bands.basicRate.threshold
    );
    if (intermediateBand > 0) {
      tax += intermediateBand * bands.intermediateRate.rate;
      remainingIncome -= intermediateBand;
    }

    // Higher rate (42%)
    const higherBand = Math.min(
      remainingIncome,
      bands.higherRate.threshold - bands.intermediateRate.threshold
    );
    if (higherBand > 0) {
      tax += higherBand * bands.higherRate.rate;
      remainingIncome -= higherBand;
    }

    // Advanced rate (45%)
    const advancedBand = Math.min(
      remainingIncome,
      bands.advancedRate.threshold - bands.higherRate.threshold
    );
    if (advancedBand > 0) {
      tax += advancedBand * bands.advancedRate.rate;
      remainingIncome -= advancedBand;
    }

    // Top rate (48%)
    if (remainingIncome > 0) {
      tax += remainingIncome * bands.topRate.rate;
    }

    return tax;
  }, []);

  // Calculate impacts
  const impacts = useMemo(() => {
    const { employment_income, is_married, partner_income, children_ages } = inputs;

    // Calculate total household income
    const totalIncome = employment_income + (is_married ? partner_income : 0);

    // SCP Baby Boost calculation
    const babiesCount = children_ages.filter((age) => age < 1).length;
    // SCP eligibility based on income threshold (proxy for UC/qualifying benefits eligibility)
    const eligibleForSCP = totalIncome <= SCP_INCOME_THRESHOLD && children_ages.length > 0;

    const scpBabyBoostImpact = eligibleForSCP && babiesCount > 0
      ? SCP_BABY_BOOST * babiesCount
      : 0;

    // Income tax threshold uplift calculation
    // Calculate tax under baseline and reform
    const baselineTax = calculateScottishTax(employment_income, BASELINE_BANDS);
    const reformTax = calculateScottishTax(employment_income, REFORMED_BANDS);
    const taxSaving = baselineTax - reformTax;

    // Partner tax saving
    let partnerTaxSaving = 0;
    if (is_married && partner_income > 0) {
      const partnerBaselineTax = calculateScottishTax(partner_income, BASELINE_BANDS);
      const partnerReformTax = calculateScottishTax(partner_income, REFORMED_BANDS);
      partnerTaxSaving = partnerBaselineTax - partnerReformTax;
    }

    const totalTaxSaving = taxSaving + partnerTaxSaving;

    return {
      scp_baby_boost: scpBabyBoostImpact,
      income_tax_threshold: totalTaxSaving,
      total: scpBabyBoostImpact + totalTaxSaving,
      details: {
        babiesCount,
        eligibleForSCP,
        baselineTax,
        reformTax,
        taxSaving,
        partnerTaxSaving,
      },
    };
  }, [inputs, calculateScottishTax]);

  // Format currency
  const formatCurrency = useCallback((value, showSign = true) => {
    const sign = showSign && value >= 0 ? "+" : "";
    return `${sign}£${Math.abs(value).toLocaleString("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }, []);

  const childrenCount = inputs.children_ages.length;
  const babiesCount = inputs.children_ages.filter((age) => age < 1).length;

  return (
    <div className="household-calculator">
      <div className="calculator-header">
        <h3>Calculate your household impact</h3>
        <p className="calculator-subtitle">
          Enter your household details to see how the Scottish Budget 2026-27 affects you
        </p>
      </div>

      <div className="calculator-layout">
        {/* Inputs */}
        <div className="calculator-inputs">
          <h4>Household details</h4>

          {/* Employment income slider */}
          {SLIDER_CONFIGS.map((config) => (
            <div className="input-group" key={config.id}>
              <label>{config.label}</label>
              <div className="slider-row">
                <input
                  type="range"
                  value={inputs[config.id]}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  onChange={(e) => handleInputChange(config.id, parseFloat(e.target.value))}
                />
                <span className="slider-value">{config.format(inputs[config.id])}</span>
              </div>
            </div>
          ))}

          {/* Married checkbox */}
          <div className="input-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={inputs.is_married}
                onChange={(e) => handleInputChange("is_married", e.target.checked)}
              />
              Married or cohabiting
            </label>
          </div>

          {/* Partner income */}
          {inputs.is_married && (
            <div className="input-group">
              <label>Partner's annual employment income</label>
              <div className="slider-row">
                <input
                  type="range"
                  value={inputs.partner_income}
                  min={0}
                  max={150000}
                  step={1000}
                  onChange={(e) => handleInputChange("partner_income", parseFloat(e.target.value))}
                />
                <span className="slider-value">£{d3.format(",.0f")(inputs.partner_income)}</span>
              </div>
            </div>
          )}

          {/* Children */}
          <div className="input-group">
            <label>Children (add ages)</label>
            <div className="children-input-row">
              <input
                type="number"
                value={childAgeInput}
                onChange={(e) => setChildAgeInput(e.target.value)}
                placeholder="Age"
                min="0"
                max="18"
                className="age-input"
              />
              <button type="button" onClick={addChild} className="add-btn">
                Add
              </button>
            </div>
            {childrenCount > 0 && (
              <div className="children-tags">
                {inputs.children_ages.map((age, index) => (
                  <span key={index} className={`child-tag ${age < 1 ? "baby" : ""}`}>
                    {age < 1 ? "Baby" : `${age}yr`}
                    <button type="button" onClick={() => removeChild(index)} className="remove-btn">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <span className="help-text">
              {babiesCount > 0
                ? `${babiesCount} baby/babies under 1 eligible for SCP boost`
                : "Add a baby (age 0) to see SCP baby boost impact"}
            </span>
          </div>

        </div>

        {/* Results */}
        <div className="calculator-results">
          {/* Total impact card */}
          <div className={`total-impact-card ${impacts.total > 0 ? "positive" : impacts.total < 0 ? "negative" : "neutral"}`}>
            <div className="total-label">Your estimated annual gain</div>
            <div className="total-value">{formatCurrency(impacts.total)}</div>
            <div className="total-context">
              {impacts.total > 0
                ? "per year from Scottish Budget 2026-27"
                : "No impact from these policies"}
            </div>
          </div>

          {/* Breakdown by reform */}
          <div className="impact-breakdown">
            <h4>Breakdown by policy</h4>
            {REFORMS.map((reform) => {
              const value = impacts[reform.key];
              return (
                <div key={reform.key} className="reform-row">
                  <div className="reform-info">
                    <div className="reform-color" style={{ backgroundColor: reform.color }} />
                    <div className="reform-details">
                      <span className="reform-label">{reform.label}</span>
                      <span className="reform-description">{reform.description}</span>
                    </div>
                  </div>
                  <div className={`reform-value ${value > 0 ? "positive" : value < 0 ? "negative" : ""}`}>
                    {formatCurrency(value)}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Reforms explanation */}
      <div className="reforms-explanation">
        <h4>About the reforms</h4>
        <p>
          <strong>SCP Baby Boost:</strong> The Scottish Child Payment increases to £40/week for babies
          under 1 (up from £27.15/week), for families receiving Universal Credit or other qualifying benefits.
        </p>
        <p>
          <strong>Income Tax Threshold Uplift:</strong> The basic rate threshold rises from £14,877 to
          £16,537, and the intermediate rate threshold from £26,562 to £29,527 (7.4% increases).
        </p>
      </div>
    </div>
  );
}

export default HouseholdCalculator;
