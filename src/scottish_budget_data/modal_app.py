"""Modal deployment for Scottish Budget household calculator API."""

import modal

app = modal.App("scottish-budget-api")

# Create image with all dependencies (Python 3.13 required for policyengine-uk>=2.68)
# v3: uses shared reform functions from reforms.py
image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install(
        "flask",
        "flask-cors",
        "asgiref",
        "policyengine-uk>=2.68.0",
    )
)

# Year for personal calculator
YEAR = 2026


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
    import numpy as np

    flask_app = Flask(__name__)
    CORS(flask_app)

    # Import reform constants and functions
    # Note: These are defined inline since Modal runs in isolated environment
    # They mirror the logic in reforms.py for consistency

    # Constants (must match reforms.py)
    WEEKS_IN_YEAR = 52
    SCP_BABY_BOOST = 40.00 - 27.15  # £12.85/week extra
    INCOME_TAX_BASIC_INCREASE = 1_069
    INCOME_TAX_INTERMEDIATE_INCREASE = 1_665

    def apply_income_tax_threshold_uplift_for_year(sim, year: int):
        """Apply Scottish income tax threshold uplift for a single year.

        Mirrors reforms.apply_income_tax_threshold_uplift_for_year()
        """
        params = sim.tax_benefit_system.parameters
        scotland_rates = params.gov.hmrc.income_tax.rates.scotland.rates

        baseline_basic = scotland_rates.brackets[1].threshold(f"{year}-01-01")
        baseline_intermediate = scotland_rates.brackets[2].threshold(f"{year}-01-01")

        scotland_rates.brackets[1].threshold.update(
            period=f"{year}-01-01",
            value=baseline_basic + INCOME_TAX_BASIC_INCREASE,
        )
        scotland_rates.brackets[2].threshold.update(
            period=f"{year}-01-01",
            value=baseline_intermediate + INCOME_TAX_INTERMEDIATE_INCREASE,
        )

    def apply_scp_baby_boost_for_year(sim, year: int):
        """Apply SCP Premium for under-ones for a single year.

        Mirrors reforms.apply_scp_baby_boost_for_year()
        """
        current_scp = sim.calculate("scottish_child_payment", year)
        age = sim.calculate("age", year, map_to="person")
        is_baby = np.array(age) < 1
        babies_per_benunit = sim.map_result(is_baby.astype(float), "person", "benunit")
        annual_boost = np.array(babies_per_benunit) * SCP_BABY_BOOST * WEEKS_IN_YEAR
        already_receives_scp = np.array(current_scp) > 0
        baby_boost = np.where(already_receives_scp, annual_boost, 0)
        new_scp = np.array(current_scp) + baby_boost
        sim.set_input("scottish_child_payment", year, new_scp)

    def create_situation(inputs: dict) -> dict:
        """Create a PolicyEngine situation from inputs."""
        employment_income = inputs.get("employment_income", 30000)
        is_married = inputs.get("is_married", False)
        partner_income = inputs.get("partner_income", 0)
        children_ages = inputs.get("children_ages", [])

        people = {
            "adult1": {
                "age": {YEAR: 35},
                "employment_income": {YEAR: employment_income},
            },
        }
        members = ["adult1"]

        if is_married:
            people["adult2"] = {
                "age": {YEAR: 33},
                "employment_income": {YEAR: partner_income},
            }
            members.append("adult2")

        for i, age in enumerate(children_ages):
            child_id = f"child{i + 1}"
            people[child_id] = {"age": {YEAR: age}}
            members.append(child_id)

        return {
            "people": people,
            "benunits": {"benunit": {"members": members}},
            "households": {
                "household": {"members": members, "region": {YEAR: "SCOTLAND"}}
            },
        }

    def create_situation_with_axes(inputs: dict, earnings_count: int = 31) -> dict:
        """Create a PolicyEngine situation with axes for vectorized earnings variation."""
        is_married = inputs.get("is_married", False)
        partner_income = inputs.get("partner_income", 0)
        children_ages = inputs.get("children_ages", [])

        people = {
            "adult1": {
                "age": {YEAR: 35},
            },
        }
        members = ["adult1"]

        if is_married:
            people["adult2"] = {
                "age": {YEAR: 33},
                "employment_income": {YEAR: partner_income},
            }
            members.append("adult2")

        for i, age in enumerate(children_ages):
            child_id = f"child{i + 1}"
            people[child_id] = {"age": {YEAR: age}}
            members.append(child_id)

        return {
            "people": people,
            "benunits": {"benunit": {"members": members}},
            "households": {
                "household": {"members": members, "region": {YEAR: "SCOTLAND"}}
            },
            "axes": [[{
                "name": "employment_income",
                "min": 0,
                "max": 150000,
                "count": earnings_count,
                "period": YEAR,
            }]],
        }

    @flask_app.route("/calculate", methods=["POST"])
    def calculate():
        """Calculate household impact from Scottish Budget reforms."""
        try:
            inputs = request.get_json()
            situation = create_situation(inputs)

            baseline_sim = Simulation(situation=situation)
            baseline_sim.calculate("scottish_child_payment", YEAR)
            baseline_net = float(baseline_sim.calculate("household_net_income", YEAR)[0])

            income_tax_sim = Simulation(situation=situation)
            apply_income_tax_threshold_uplift_for_year(income_tax_sim, YEAR)
            income_tax_sim.calculate("scottish_child_payment", YEAR)
            income_tax_net = float(income_tax_sim.calculate("household_net_income", YEAR)[0])
            income_tax_impact = income_tax_net - baseline_net

            scp_sim = Simulation(situation=situation)
            scp_sim.calculate("scottish_child_payment", YEAR)
            apply_scp_baby_boost_for_year(scp_sim, YEAR)
            scp_net = float(scp_sim.calculate("household_net_income", YEAR)[0])
            scp_impact = scp_net - baseline_net

            total = income_tax_impact + scp_impact

            return jsonify({
                "impacts": {
                    "scp_baby_boost": round(scp_impact, 2),
                    "income_tax_threshold_uplift": round(income_tax_impact, 2),
                },
                "total": round(total, 2),
                "baseline_net_income": round(baseline_net, 2),
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    @flask_app.route("/calculate-variation", methods=["POST"])
    def calculate_variation():
        """Calculate household impact across earnings range for chart display."""
        try:
            inputs = request.get_json()
            earnings_count = 301

            situation = create_situation_with_axes(inputs, earnings_count)

            baseline_sim = Simulation(situation=situation)
            baseline_sim.calculate("scottish_child_payment", YEAR)
            baseline_nets = baseline_sim.calculate("household_net_income", YEAR)

            income_tax_sim = Simulation(situation=situation)
            apply_income_tax_threshold_uplift_for_year(income_tax_sim, YEAR)
            income_tax_sim.calculate("scottish_child_payment", YEAR)
            income_tax_nets = income_tax_sim.calculate("household_net_income", YEAR)
            income_tax_impacts = income_tax_nets - baseline_nets

            scp_sim = Simulation(situation=situation)
            scp_sim.calculate("scottish_child_payment", YEAR)
            apply_scp_baby_boost_for_year(scp_sim, YEAR)
            scp_nets = scp_sim.calculate("household_net_income", YEAR)
            scp_impacts = scp_nets - baseline_nets

            earnings_step = 500
            results = []
            for i in range(earnings_count):
                earnings = i * earnings_step
                results.append({
                    "earnings": earnings,
                    "income_tax_threshold_uplift": round(float(income_tax_impacts[i]), 2),
                    "scp_baby_boost": round(float(scp_impacts[i]), 2),
                    "total": round(float(income_tax_impacts[i] + scp_impacts[i]), 2),
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
        return jsonify({"status": "ok", "service": "scottish-budget-api"})

    # Convert Flask to ASGI using Werkzeug's adapter
    from werkzeug.middleware.dispatcher import DispatcherMiddleware
    from werkzeug.serving import WSGIRequestHandler

    # Use a simple WSGI to ASGI adapter
    from asgiref.wsgi import WsgiToAsgi
    return WsgiToAsgi(flask_app)
