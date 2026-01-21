"""Modal deployment for Scottish Budget household calculator API.

Calculates all 7 reforms:
- income_tax_basic_uplift
- income_tax_intermediate_uplift
- higher_rate_freeze
- advanced_rate_freeze
- top_rate_freeze
- scp_inflation
- scp_baby_boost
"""

import modal

app = modal.App("scottish-budget-api")

# Create image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install(
        "flask",
        "flask-cors",
        "asgiref",
        "policyengine-uk>=2.68.0",
    )
)


@app.function(
    image=image,
    timeout=300,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def flask_app():
    """Serve the Flask API via Modal."""
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    from policyengine_uk import Simulation

    flask_app = Flask(__name__)
    CORS(flask_app)

    # Scottish Budget 2026-27 policy parameters
    # Income tax thresholds (amounts ABOVE personal allowance £12,570)
    BASIC_THRESHOLD_2026 = 3_968      # £16,538 total (7.4% uplift)
    INTERMEDIATE_THRESHOLD_2026 = 16_957  # £29,527 total (7.4% uplift)
    HIGHER_THRESHOLD_FROZEN = 31_093   # £43,663 total (frozen 2027-28, 2028-29)
    ADVANCED_THRESHOLD_FROZEN = 62_431  # £75,001 total (frozen 2027-28, 2028-29)
    TOP_THRESHOLD_FROZEN = 112_571     # £125,141 total (frozen 2027-28, 2028-29)

    # SCP rates (£/week)
    SCP_BASELINE_RATE = 27.15  # Pre-inflation rate
    SCP_INFLATION_RATE = 28.20  # Post-inflation rate (+3.9%)

    # CPI forecasts for uprating (from OBR)
    CPI_FORECASTS = {
        2026: 0.024,
        2027: 0.021,
        2028: 0.020,
        2029: 0.020,
        2030: 0.020,
    }

    def get_cpi_uprating_factor(base_year: int, target_year: int) -> float:
        """Calculate CPI uprating factor from base year to target year."""
        if target_year <= base_year:
            return 1.0
        factor = 1.0
        for y in range(base_year, target_year):
            factor *= (1 + CPI_FORECASTS.get(y, 0.02))
        return factor

    def create_situation(inputs: dict, year: int) -> dict:
        """Create a PolicyEngine situation from inputs."""
        employment_income = inputs.get("employment_income", 30000)
        is_married = inputs.get("is_married", False)
        partner_income = inputs.get("partner_income", 0)
        children_ages = inputs.get("children_ages", [])

        people = {
            "adult1": {
                "age": {year: 35},
                "employment_income": {year: employment_income},
            },
        }
        members = ["adult1"]

        if is_married:
            people["adult2"] = {
                "age": {year: 33},
                "employment_income": {year: partner_income},
            }
            members.append("adult2")

        for i, age in enumerate(children_ages):
            child_id = f"child{i + 1}"
            people[child_id] = {"age": {year: age}}
            members.append(child_id)

        return {
            "people": people,
            "benunits": {"benunit": {"members": members}},
            "households": {
                "household": {"members": members, "region": {year: "SCOTLAND"}}
            },
        }

    def apply_basic_rate_uplift(sim, year: int) -> None:
        """Apply basic rate threshold uplift (7.4% in 2026, then CPI uprated)."""
        scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates
        uprated_value = round(BASIC_THRESHOLD_2026 * get_cpi_uprating_factor(2026, year))
        scotland_rates.brackets[1].threshold.update(period=f"{year}-01-01", value=uprated_value)

    def apply_intermediate_rate_uplift(sim, year: int) -> None:
        """Apply intermediate rate threshold uplift (7.4% in 2026, then CPI uprated)."""
        scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates
        uprated_value = round(INTERMEDIATE_THRESHOLD_2026 * get_cpi_uprating_factor(2026, year))
        scotland_rates.brackets[2].threshold.update(period=f"{year}-01-01", value=uprated_value)

    def apply_higher_rate_freeze(sim, year: int) -> None:
        """Apply higher rate threshold freeze (frozen 2027-28, 2028-29, then CPI from frozen base)."""
        if year < 2027:
            return  # 2026 freeze already in baseline
        scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates
        if year in [2027, 2028]:
            scotland_rates.brackets[3].threshold.update(period=f"{year}-01-01", value=HIGHER_THRESHOLD_FROZEN)
        else:  # 2029+: CPI uprate from frozen base
            uprated = round(HIGHER_THRESHOLD_FROZEN * get_cpi_uprating_factor(2028, year))
            scotland_rates.brackets[3].threshold.update(period=f"{year}-01-01", value=uprated)

    def apply_advanced_rate_freeze(sim, year: int) -> None:
        """Apply advanced rate threshold freeze (frozen 2027-28, 2028-29, then CPI from frozen base)."""
        if year < 2027:
            return  # 2026 freeze already in baseline
        scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates
        if year in [2027, 2028]:
            scotland_rates.brackets[4].threshold.update(period=f"{year}-01-01", value=ADVANCED_THRESHOLD_FROZEN)
        else:  # 2029+: CPI uprate from frozen base
            uprated = round(ADVANCED_THRESHOLD_FROZEN * get_cpi_uprating_factor(2028, year))
            scotland_rates.brackets[4].threshold.update(period=f"{year}-01-01", value=uprated)

    def apply_top_rate_freeze(sim, year: int) -> None:
        """Apply top rate threshold freeze (frozen 2027-28, 2028-29, then CPI from frozen base)."""
        if year < 2027:
            return  # 2026 freeze already in baseline
        scotland_rates = sim.tax_benefit_system.parameters.gov.hmrc.income_tax.rates.scotland.rates
        if year in [2027, 2028]:
            scotland_rates.brackets[5].threshold.update(period=f"{year}-01-01", value=TOP_THRESHOLD_FROZEN)
        else:  # 2029+: CPI uprate from frozen base
            uprated = round(TOP_THRESHOLD_FROZEN * get_cpi_uprating_factor(2028, year))
            scotland_rates.brackets[5].threshold.update(period=f"{year}-01-01", value=uprated)

    def apply_scp_inflation(sim, year: int) -> None:
        """Apply SCP inflation adjustment (£27.15 → £28.20/week)."""
        scp_amount = sim.tax_benefit_system.parameters.gov.social_security_scotland.scottish_child_payment.amount
        scp_amount.update(period=f"{year}-01-01", value=SCP_INFLATION_RATE)

    def set_scp_baseline_rate(sim, year: int) -> None:
        """Set SCP to baseline rate (£27.15/week) for measuring inflation impact."""
        scp_amount = sim.tax_benefit_system.parameters.gov.social_security_scotland.scottish_child_payment.amount
        scp_amount.update(period=f"{year}-01-01", value=SCP_BASELINE_RATE)

    def apply_scp_baby_boost(sim, year: int) -> None:
        """Enable SCP baby boost (£40/week for under-1s from 2027)."""
        if year < 2027:
            return  # Baby boost starts 2027
        scp_reform = sim.tax_benefit_system.parameters.gov.contrib.scotland.scottish_child_payment
        scp_reform.in_effect.update(period=f"{year}-01-01", value=True)

    def disable_scp_baby_boost(sim, year: int) -> None:
        """Disable SCP baby boost to measure its impact."""
        if year < 2027:
            return  # Baby boost only exists from 2027
        scp_reform = sim.tax_benefit_system.parameters.gov.contrib.scotland.scottish_child_payment
        scp_reform.in_effect.update(period=f"{year}-01-01", value=False)

    @flask_app.route("/calculate", methods=["POST"])
    def calculate():
        """Calculate household impact from all 7 Scottish Budget reforms."""
        try:
            inputs = request.get_json()
            year = inputs.get("year", 2027)
            situation = create_situation(inputs, year)
            receives_uc = inputs.get("receives_uc", True)

            # === BASELINE ===
            baseline_sim = Simulation(situation=situation)
            set_scp_baseline_rate(baseline_sim, year)
            disable_scp_baby_boost(baseline_sim, year)
            baseline_sim.calculate("scottish_child_payment", year)
            baseline_net = float(baseline_sim.calculate("household_net_income", year)[0])

            impacts = {}

            # === 1. Basic rate threshold uplift ===
            basic_sim = Simulation(situation=situation)
            set_scp_baseline_rate(basic_sim, year)
            disable_scp_baby_boost(basic_sim, year)
            apply_basic_rate_uplift(basic_sim, year)
            basic_sim.calculate("scottish_child_payment", year)
            basic_net = float(basic_sim.calculate("household_net_income", year)[0])
            impacts["income_tax_basic_uplift"] = round(basic_net - baseline_net, 2)

            # === 2. Intermediate rate threshold uplift ===
            intermediate_sim = Simulation(situation=situation)
            set_scp_baseline_rate(intermediate_sim, year)
            disable_scp_baby_boost(intermediate_sim, year)
            apply_intermediate_rate_uplift(intermediate_sim, year)
            intermediate_sim.calculate("scottish_child_payment", year)
            intermediate_net = float(intermediate_sim.calculate("household_net_income", year)[0])
            impacts["income_tax_intermediate_uplift"] = round(intermediate_net - baseline_net, 2)

            # === 3. Higher rate threshold freeze ===
            higher_sim = Simulation(situation=situation)
            set_scp_baseline_rate(higher_sim, year)
            disable_scp_baby_boost(higher_sim, year)
            apply_higher_rate_freeze(higher_sim, year)
            higher_sim.calculate("scottish_child_payment", year)
            higher_net = float(higher_sim.calculate("household_net_income", year)[0])
            impacts["higher_rate_freeze"] = round(higher_net - baseline_net, 2)

            # === 4. Advanced rate threshold freeze ===
            advanced_sim = Simulation(situation=situation)
            set_scp_baseline_rate(advanced_sim, year)
            disable_scp_baby_boost(advanced_sim, year)
            apply_advanced_rate_freeze(advanced_sim, year)
            advanced_sim.calculate("scottish_child_payment", year)
            advanced_net = float(advanced_sim.calculate("household_net_income", year)[0])
            impacts["advanced_rate_freeze"] = round(advanced_net - baseline_net, 2)

            # === 5. Top rate threshold freeze ===
            top_sim = Simulation(situation=situation)
            set_scp_baseline_rate(top_sim, year)
            disable_scp_baby_boost(top_sim, year)
            apply_top_rate_freeze(top_sim, year)
            top_sim.calculate("scottish_child_payment", year)
            top_net = float(top_sim.calculate("household_net_income", year)[0])
            impacts["top_rate_freeze"] = round(top_net - baseline_net, 2)

            # === 6. SCP inflation adjustment ===
            if receives_uc:
                scp_inf_sim = Simulation(situation=situation)
                apply_scp_inflation(scp_inf_sim, year)
                disable_scp_baby_boost(scp_inf_sim, year)
                scp_inf_sim.calculate("scottish_child_payment", year)
                scp_inf_net = float(scp_inf_sim.calculate("household_net_income", year)[0])
                baseline_scp_sim = Simulation(situation=situation)
                set_scp_baseline_rate(baseline_scp_sim, year)
                disable_scp_baby_boost(baseline_scp_sim, year)
                baseline_scp_sim.calculate("scottish_child_payment", year)
                baseline_scp_net = float(baseline_scp_sim.calculate("household_net_income", year)[0])
                impacts["scp_inflation"] = round(scp_inf_net - baseline_scp_net, 2)
            else:
                impacts["scp_inflation"] = 0.0

            # === 7. SCP Premium for under-ones (baby boost) ===
            if receives_uc and year >= 2027:
                baby_sim = Simulation(situation=situation)
                apply_scp_inflation(baby_sim, year)
                apply_scp_baby_boost(baby_sim, year)
                baby_sim.calculate("scottish_child_payment", year)
                baby_net = float(baby_sim.calculate("household_net_income", year)[0])
                no_baby_sim = Simulation(situation=situation)
                apply_scp_inflation(no_baby_sim, year)
                disable_scp_baby_boost(no_baby_sim, year)
                no_baby_sim.calculate("scottish_child_payment", year)
                no_baby_net = float(no_baby_sim.calculate("household_net_income", year)[0])
                impacts["scp_baby_boost"] = round(baby_net - no_baby_net, 2)
            else:
                impacts["scp_baby_boost"] = 0.0

            # Calculate total
            total = sum(impacts.values())

            return jsonify({
                "impacts": impacts,
                "total": round(total, 2),
                "baseline_net_income": round(baseline_net, 2),
                "year": year,
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    def create_situation_with_axes(inputs: dict, year: int, earnings_count: int = 31) -> dict:
        """Create a PolicyEngine situation with axes for vectorized earnings variation."""
        is_married = inputs.get("is_married", False)
        partner_income = inputs.get("partner_income", 0)
        children_ages = inputs.get("children_ages", [])

        people = {
            "adult1": {
                "age": {year: 35},
            },
        }
        members = ["adult1"]

        if is_married:
            people["adult2"] = {
                "age": {year: 33},
                "employment_income": {year: partner_income},
            }
            members.append("adult2")

        for i, age in enumerate(children_ages):
            child_id = f"child{i + 1}"
            people[child_id] = {"age": {year: age}}
            members.append(child_id)

        return {
            "people": people,
            "benunits": {"benunit": {"members": members}},
            "households": {
                "household": {"members": members, "region": {year: "SCOTLAND"}}
            },
            "axes": [[{
                "name": "employment_income",
                "min": 0,
                "max": 200000,
                "count": earnings_count,
                "period": year,
            }]],
        }

    @flask_app.route("/calculate-variation", methods=["POST"])
    def calculate_variation():
        """Calculate household impact across earnings range for chart display."""
        try:
            inputs = request.get_json()
            year = inputs.get("year", 2027)
            receives_uc = inputs.get("receives_uc", True)
            earnings_count = 201  # 0 to 200k in 1k steps

            situation = create_situation_with_axes(inputs, year, earnings_count)

            # Baseline (no reforms)
            baseline_sim = Simulation(situation=situation)
            set_scp_baseline_rate(baseline_sim, year)
            disable_scp_baby_boost(baseline_sim, year)
            baseline_sim.calculate("scottish_child_payment", year)
            baseline_nets = baseline_sim.calculate("household_net_income", year)

            # Combined income tax uplifts
            tax_sim = Simulation(situation=situation)
            set_scp_baseline_rate(tax_sim, year)
            disable_scp_baby_boost(tax_sim, year)
            apply_basic_rate_uplift(tax_sim, year)
            apply_intermediate_rate_uplift(tax_sim, year)
            tax_sim.calculate("scottish_child_payment", year)
            tax_nets = tax_sim.calculate("household_net_income", year)
            tax_impacts = tax_nets - baseline_nets

            # Combined threshold freezes (negative impact)
            freeze_sim = Simulation(situation=situation)
            set_scp_baseline_rate(freeze_sim, year)
            disable_scp_baby_boost(freeze_sim, year)
            apply_higher_rate_freeze(freeze_sim, year)
            apply_advanced_rate_freeze(freeze_sim, year)
            apply_top_rate_freeze(freeze_sim, year)
            freeze_sim.calculate("scottish_child_payment", year)
            freeze_nets = freeze_sim.calculate("household_net_income", year)
            freeze_impacts = freeze_nets - baseline_nets

            # SCP impacts (only if receives UC)
            if receives_uc:
                scp_sim = Simulation(situation=situation)
                apply_scp_inflation(scp_sim, year)
                if year >= 2027:
                    apply_scp_baby_boost(scp_sim, year)
                scp_sim.calculate("scottish_child_payment", year)
                scp_nets = scp_sim.calculate("household_net_income", year)

                scp_baseline_sim = Simulation(situation=situation)
                set_scp_baseline_rate(scp_baseline_sim, year)
                disable_scp_baby_boost(scp_baseline_sim, year)
                scp_baseline_sim.calculate("scottish_child_payment", year)
                scp_baseline_nets = scp_baseline_sim.calculate("household_net_income", year)
                scp_impacts = scp_nets - scp_baseline_nets
            else:
                scp_impacts = [0.0] * earnings_count

            # Build results
            earnings_step = 1000  # £1k increments
            results = []
            for i in range(earnings_count):
                earnings = i * earnings_step
                income_tax_impact = float(tax_impacts[i]) + float(freeze_impacts[i])
                scp_impact = float(scp_impacts[i]) if receives_uc else 0.0
                results.append({
                    "earnings": earnings,
                    "income_tax": round(income_tax_impact, 2),
                    "scp": round(scp_impact, 2),
                    "total": round(income_tax_impact + scp_impact, 2),
                })

            return jsonify({"data": results})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    @flask_app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "healthy"})

    @flask_app.route("/", methods=["GET"])
    def root():
        return jsonify({"status": "ok", "service": "scottish-budget-api", "version": "2.0"})

    # Convert Flask to ASGI
    from asgiref.wsgi import WsgiToAsgi
    return WsgiToAsgi(flask_app)
