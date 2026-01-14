"""Simple Flask API for Scottish Budget household impact calculations.

Uses policyengine_uk locally to calculate reform impacts.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from policyengine_uk import Simulation

from .reforms import (
    _income_tax_threshold_uplift_modifier,
    _scp_baby_boost_modifier,
)

app = Flask(__name__)
CORS(app)

YEAR = 2026


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


@app.route("/calculate", methods=["POST"])
def calculate():
    """Calculate household impact from Scottish Budget reforms."""
    try:
        inputs = request.get_json()
        situation = create_situation(inputs)

        # Baseline simulation
        # Note: Must calculate SCP before household_net_income due to policyengine_uk
        # dependency issue - otherwise SCP isn't included in the calculation
        baseline_sim = Simulation(situation=situation)
        baseline_sim.calculate("scottish_child_payment", YEAR)  # Trigger SCP dependency
        baseline_net = float(baseline_sim.calculate("household_net_income", YEAR)[0])

        # Income tax threshold reform - apply modifier directly
        income_tax_sim = Simulation(situation=situation)
        _income_tax_threshold_uplift_modifier(income_tax_sim)
        income_tax_sim.calculate("scottish_child_payment", YEAR)
        income_tax_net = float(income_tax_sim.calculate("household_net_income", YEAR)[0])
        income_tax_impact = income_tax_net - baseline_net

        # SCP baby boost - apply modifier directly
        scp_sim = Simulation(situation=situation)
        scp_sim.calculate("scottish_child_payment", YEAR)
        _scp_baby_boost_modifier(scp_sim)
        scp_net = float(scp_sim.calculate("household_net_income", YEAR)[0])
        scp_impact = scp_net - baseline_net

        # Combined impact
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


@app.route("/calculate-variation", methods=["POST"])
def calculate_variation():
    """Calculate household impact across earnings range for chart display (vectorized)."""
    try:
        inputs = request.get_json()
        earnings_count = 301  # 0 to 150k in 500 steps

        situation = create_situation_with_axes(inputs, earnings_count)

        # Baseline simulation (vectorized across all earnings levels)
        baseline_sim = Simulation(situation=situation)
        baseline_sim.calculate("scottish_child_payment", YEAR)
        baseline_nets = baseline_sim.calculate("household_net_income", YEAR)

        # Income tax reform (vectorized) - apply modifier directly
        income_tax_sim = Simulation(situation=situation)
        _income_tax_threshold_uplift_modifier(income_tax_sim)
        income_tax_sim.calculate("scottish_child_payment", YEAR)
        income_tax_nets = income_tax_sim.calculate("household_net_income", YEAR)
        income_tax_impacts = income_tax_nets - baseline_nets

        # SCP baby boost (vectorized) - apply modifier directly
        scp_sim = Simulation(situation=situation)
        scp_sim.calculate("scottish_child_payment", YEAR)
        _scp_baby_boost_modifier(scp_sim)
        scp_nets = scp_sim.calculate("household_net_income", YEAR)
        scp_impacts = scp_nets - baseline_nets

        # Build results
        earnings_step = 500  # £500 increments
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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
