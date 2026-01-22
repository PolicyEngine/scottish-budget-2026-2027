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
# Pin policyengine-uk to 2.72.2 for contrib.scotland.scottish_child_payment support
image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install(
        "flask",
        "flask-cors",
        "asgiref",
        "policyengine-uk==2.72.2",
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

    def create_vectorized_situation(inputs: dict, year: int, income_levels: list) -> dict:
        """Create a vectorized situation with multiple households at different income levels.

        This allows computing impacts for 100 income levels in a single simulation.
        """
        import numpy as np

        is_married = inputs.get("is_married", False)
        partner_income = inputs.get("partner_income", 0)
        children_ages = inputs.get("children_ages", [])
        n_households = len(income_levels)

        people = {}
        benunits = {}
        households = {}

        for i, income in enumerate(income_levels):
            hh_id = f"hh{i}"
            adult1_id = f"adult1_{i}"

            people[adult1_id] = {
                "age": {year: 35},
                "employment_income": {year: float(income)},
            }
            members = [adult1_id]

            if is_married:
                adult2_id = f"adult2_{i}"
                people[adult2_id] = {
                    "age": {year: 33},
                    "employment_income": {year: float(partner_income)},
                }
                members.append(adult2_id)

            for j, age in enumerate(children_ages):
                child_id = f"child{j}_{i}"
                people[child_id] = {"age": {year: int(age)}}
                members.append(child_id)

            benunits[f"benunit_{i}"] = {"members": members}
            households[hh_id] = {"members": members, "region": {year: "SCOTLAND"}}

        return {
            "people": people,
            "benunits": benunits,
            "households": households,
        }

    def calculate_vectorized_by_income(inputs: dict, year: int, receives_uc: bool) -> list:
        """Calculate impacts for 100 income levels using vectorization.

        Returns list of {income, total, ...impacts} dicts.
        """
        import numpy as np

        # 50 income levels from £0 to £200k (faster computation)
        income_levels = list(range(0, 200001, 4000))  # 0, 4000, 8000, ..., 200000
        n = len(income_levels)

        situation = create_vectorized_situation(inputs, year, income_levels)

        # Baseline simulation
        baseline_sim = Simulation(situation=situation)
        set_scp_baseline_rate(baseline_sim, year)
        disable_scp_baby_boost(baseline_sim, year)
        baseline_sim.calculate("scottish_child_payment", year)
        baseline_nets = baseline_sim.calculate("household_net_income", year)

        results = {
            "income_tax_basic_uplift": np.zeros(n),
            "income_tax_intermediate_uplift": np.zeros(n),
            "higher_rate_freeze": np.zeros(n),
            "advanced_rate_freeze": np.zeros(n),
            "top_rate_freeze": np.zeros(n),
            "scp_inflation": np.zeros(n),
            "scp_baby_boost": np.zeros(n),
        }

        # 1. Basic rate uplift
        basic_sim = Simulation(situation=situation)
        set_scp_baseline_rate(basic_sim, year)
        disable_scp_baby_boost(basic_sim, year)
        apply_basic_rate_uplift(basic_sim, year)
        basic_sim.calculate("scottish_child_payment", year)
        basic_nets = basic_sim.calculate("household_net_income", year)
        results["income_tax_basic_uplift"] = basic_nets - baseline_nets

        # 2. Intermediate rate uplift
        intermediate_sim = Simulation(situation=situation)
        set_scp_baseline_rate(intermediate_sim, year)
        disable_scp_baby_boost(intermediate_sim, year)
        apply_intermediate_rate_uplift(intermediate_sim, year)
        intermediate_sim.calculate("scottish_child_payment", year)
        intermediate_nets = intermediate_sim.calculate("household_net_income", year)
        results["income_tax_intermediate_uplift"] = intermediate_nets - baseline_nets

        # 3. Higher rate freeze
        higher_sim = Simulation(situation=situation)
        set_scp_baseline_rate(higher_sim, year)
        disable_scp_baby_boost(higher_sim, year)
        apply_higher_rate_freeze(higher_sim, year)
        higher_sim.calculate("scottish_child_payment", year)
        higher_nets = higher_sim.calculate("household_net_income", year)
        results["higher_rate_freeze"] = higher_nets - baseline_nets

        # 4. Advanced rate freeze
        advanced_sim = Simulation(situation=situation)
        set_scp_baseline_rate(advanced_sim, year)
        disable_scp_baby_boost(advanced_sim, year)
        apply_advanced_rate_freeze(advanced_sim, year)
        advanced_sim.calculate("scottish_child_payment", year)
        advanced_nets = advanced_sim.calculate("household_net_income", year)
        results["advanced_rate_freeze"] = advanced_nets - baseline_nets

        # 5. Top rate freeze
        top_sim = Simulation(situation=situation)
        set_scp_baseline_rate(top_sim, year)
        disable_scp_baby_boost(top_sim, year)
        apply_top_rate_freeze(top_sim, year)
        top_sim.calculate("scottish_child_payment", year)
        top_nets = top_sim.calculate("household_net_income", year)
        results["top_rate_freeze"] = top_nets - baseline_nets

        # 6. SCP inflation (only if receives UC)
        if receives_uc:
            scp_inf_sim = Simulation(situation=situation)
            apply_scp_inflation(scp_inf_sim, year)
            disable_scp_baby_boost(scp_inf_sim, year)
            scp_inf_sim.calculate("scottish_child_payment", year)
            scp_inf_nets = scp_inf_sim.calculate("household_net_income", year)
            results["scp_inflation"] = scp_inf_nets - baseline_nets

        # 7. SCP baby boost (only if receives UC and year >= 2027)
        if receives_uc and year >= 2027:
            baby_sim = Simulation(situation=situation)
            apply_scp_inflation(baby_sim, year)
            apply_scp_baby_boost(baby_sim, year)
            baby_sim.calculate("scottish_child_payment", year)
            baby_nets = baby_sim.calculate("household_net_income", year)
            no_baby_sim = Simulation(situation=situation)
            apply_scp_inflation(no_baby_sim, year)
            disable_scp_baby_boost(no_baby_sim, year)
            no_baby_sim.calculate("scottish_child_payment", year)
            no_baby_nets = no_baby_sim.calculate("household_net_income", year)
            results["scp_baby_boost"] = baby_nets - no_baby_nets

        # Build output list
        output = []
        for i, income in enumerate(income_levels):
            total = sum(float(results[k][i]) for k in results)
            output.append({
                "income": income,
                "income_tax_basic_uplift": round(float(results["income_tax_basic_uplift"][i]), 2),
                "income_tax_intermediate_uplift": round(float(results["income_tax_intermediate_uplift"][i]), 2),
                "higher_rate_freeze": round(float(results["higher_rate_freeze"][i]), 2),
                "advanced_rate_freeze": round(float(results["advanced_rate_freeze"][i]), 2),
                "top_rate_freeze": round(float(results["top_rate_freeze"][i]), 2),
                "scp_inflation": round(float(results["scp_inflation"][i]), 2),
                "scp_baby_boost": round(float(results["scp_baby_boost"][i]), 2),
                "total": round(total, 2),
            })

        return output

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

    def calculate_for_year(inputs: dict, year: int, receives_uc: bool) -> dict:
        """Calculate all 7 reform impacts for a single year."""
        situation = create_situation(inputs, year)

        # Baseline
        baseline_sim = Simulation(situation=situation)
        set_scp_baseline_rate(baseline_sim, year)
        disable_scp_baby_boost(baseline_sim, year)
        baseline_sim.calculate("scottish_child_payment", year)
        baseline_net = float(baseline_sim.calculate("household_net_income", year)[0])

        impacts = {}

        # 1. Basic rate uplift
        basic_sim = Simulation(situation=situation)
        set_scp_baseline_rate(basic_sim, year)
        disable_scp_baby_boost(basic_sim, year)
        apply_basic_rate_uplift(basic_sim, year)
        basic_sim.calculate("scottish_child_payment", year)
        impacts["income_tax_basic_uplift"] = round(float(basic_sim.calculate("household_net_income", year)[0]) - baseline_net, 2)

        # 2. Intermediate rate uplift
        intermediate_sim = Simulation(situation=situation)
        set_scp_baseline_rate(intermediate_sim, year)
        disable_scp_baby_boost(intermediate_sim, year)
        apply_intermediate_rate_uplift(intermediate_sim, year)
        intermediate_sim.calculate("scottish_child_payment", year)
        impacts["income_tax_intermediate_uplift"] = round(float(intermediate_sim.calculate("household_net_income", year)[0]) - baseline_net, 2)

        # 3. Higher rate freeze
        higher_sim = Simulation(situation=situation)
        set_scp_baseline_rate(higher_sim, year)
        disable_scp_baby_boost(higher_sim, year)
        apply_higher_rate_freeze(higher_sim, year)
        higher_sim.calculate("scottish_child_payment", year)
        impacts["higher_rate_freeze"] = round(float(higher_sim.calculate("household_net_income", year)[0]) - baseline_net, 2)

        # 4. Advanced rate freeze
        advanced_sim = Simulation(situation=situation)
        set_scp_baseline_rate(advanced_sim, year)
        disable_scp_baby_boost(advanced_sim, year)
        apply_advanced_rate_freeze(advanced_sim, year)
        advanced_sim.calculate("scottish_child_payment", year)
        impacts["advanced_rate_freeze"] = round(float(advanced_sim.calculate("household_net_income", year)[0]) - baseline_net, 2)

        # 5. Top rate freeze
        top_sim = Simulation(situation=situation)
        set_scp_baseline_rate(top_sim, year)
        disable_scp_baby_boost(top_sim, year)
        apply_top_rate_freeze(top_sim, year)
        top_sim.calculate("scottish_child_payment", year)
        impacts["top_rate_freeze"] = round(float(top_sim.calculate("household_net_income", year)[0]) - baseline_net, 2)

        # 6. SCP inflation
        if receives_uc:
            scp_inf_sim = Simulation(situation=situation)
            apply_scp_inflation(scp_inf_sim, year)
            disable_scp_baby_boost(scp_inf_sim, year)
            scp_inf_sim.calculate("scottish_child_payment", year)
            scp_inf_net = float(scp_inf_sim.calculate("household_net_income", year)[0])
            impacts["scp_inflation"] = round(scp_inf_net - baseline_net, 2)
        else:
            impacts["scp_inflation"] = 0.0

        # 7. SCP baby boost
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

        total = sum(impacts.values())
        return {"year": year, **impacts, "total": round(total, 2)}

    @flask_app.route("/calculate-all", methods=["POST"])
    def calculate_all():
        """Combined endpoint: returns yearly data (2026-2030) in one request.

        by_income is now a separate endpoint to keep this fast.
        """
        try:
            inputs = request.get_json()
            receives_uc = inputs.get("receives_uc", True)

            # Calculate for all years (sequential - each year is fast)
            years = [2026, 2027, 2028, 2029, 2030]
            yearly_data = [calculate_for_year(inputs, year, receives_uc) for year in years]

            return jsonify({
                "yearly": yearly_data,
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    @flask_app.route("/calculate-by-income", methods=["POST"])
    def calculate_by_income():
        """Separate endpoint for by_income data (vectorized 50 income levels)."""
        try:
            inputs = request.get_json()
            receives_uc = inputs.get("receives_uc", True)
            year = inputs.get("year", 2027)

            by_income_data = calculate_vectorized_by_income(inputs, year, receives_uc)

            return jsonify({
                "by_income": by_income_data,
            })
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
