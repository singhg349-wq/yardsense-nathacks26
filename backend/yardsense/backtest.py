"""Synthetic 12-month replay: what the engine would have recommended last year.

The history is generated and synthetic. The replay deliberately excludes the
buy option: historical pipeline demand is unknown, so comparing move / sister /
outside is the defensible comparison. Every number is an estimate, not actual
performance.
"""
import json
from datetime import date
from pathlib import Path

from . import cost_model
from .config import SEED_DIR

HISTORY_PATH = SEED_DIR / "backtest_history.json"

OPTION_LABELS = {
    "move_ours": "Move ours",
    "rent_sister": "Rent from sister",
    "rent_outside": "Rent outside",
    "buy": "Buy",
}

ASSUMPTIONS = [
    "History is generated synthetic data, not real company records.",
    "Availability of group and sister units is simulated per request.",
    "Buy is excluded because historical pipeline demand is unknown.",
    "Costs use the current rate card, not the rates charged at the time.",
    "Savings are outside rental avoided, not cash profit.",
]


def load_history(path=None):
    """Read the committed synthetic history file."""
    path = path or HISTORY_PATH
    with open(path) as handle:
        return json.load(handle)


def _pipeline(world, asset_class):
    """Every planned need of this class across the current projects."""
    spans = []
    for project in world["projects"]:
        for need in project["planned_equipment"]:
            span = (date.fromisoformat(need["start"]), date.fromisoformat(need["finish"]))
            spans.extend([span] * need["qty"])
    return spans


def _units(prefix, request, site):
    """Synthetic idle units for one request's availability flags."""
    where = f"at {site['name']}"
    return [{
        "asset_id": f"{prefix}-{request['id']}-{index + 1}",
        "site_id": site["id"],
        "lat": site["lat"],
        "lon": site["lon"],
        "where": where,
    } for index in range(request["qty"])]


def _price_request(world, request, sites):
    """Rank the four options for one historical request."""
    site = sites[request["site_id"]]
    owned = _units("BT-OWNED", request, site) if request["internal_available"] else []
    sister = _units("BT-SISTER", request, site) if request["sister_available"] else []
    priced = {
        "class": request["class"],
        "qty": request["qty"],
        "start": date.fromisoformat(request["start"]),
        "finish": date.fromisoformat(request["finish"]),
        "site_id": request["site_id"],
        "dest": (site["lat"], site["lon"]),
    }
    options = cost_model.price_options(
        priced,
        world["classes"][request["class"]],
        world["settings"],
        owned,
        sister,
        [],  # buy excluded: no historical pipeline
    )
    return cost_model.rank(options)


def run_backtest(world, history=None):
    """Replay every synthetic request and summarize the outside spend avoided."""
    history = history or load_history()
    sites = {site["id"]: site for site in world["sites"]}
    rows = []
    for request in history["requests"]:
        options = _price_request(world, request, sites)
        actual = next((option for option in options
                       if option["option"] == request["actual_option"]), None)
        if actual is None or not actual["available"]:
            actual = next(option for option in options if option["option"] == "rent_outside")
        recommended = options[0]
        saved = max(0.0, actual["group_cost"] - recommended["group_cost"])
        rows.append({
            "request_id": request["id"],
            "project_name": request["project_name"],
            "class": request["class"],
            "label": world["classes"][request["class"]]["label"],
            "start": request["start"],
            "finish": request["finish"],
            "actual": actual["option"],
            "recommended": recommended["option"],
            "actual_cost": actual["group_cost"],
            "recommended_cost": recommended["group_cost"],
            "saved": round(saved, 2),
            "is_leak": actual["option"] == "rent_outside" and recommended["option"] != "rent_outside",
        })

    outside = [row for row in rows if row["actual"] == "rent_outside"]
    leaks = [row for row in outside if row["is_leak"]]
    outside_spend = round(sum(row["actual_cost"] for row in outside), 2)
    avoided = round(sum(row["saved"] for row in leaks), 2)

    by_class = []
    for code in sorted(world["classes"]):
        class_rows = [row for row in rows if row["class"] == code]
        class_outside = [row for row in class_rows if row["actual"] == "rent_outside"]
        class_leaks = [row for row in class_outside if row["is_leak"]]
        by_class.append({
            "class": code,
            "label": world["classes"][code]["label"],
            "requests": len(class_rows),
            "outside_spend": round(sum(row["actual_cost"] for row in class_outside), 2),
            "avoided": round(sum(row["saved"] for row in class_leaks), 2),
            "leaks": len(class_leaks),
        })
    by_class.sort(key=lambda entry: -entry["avoided"])

    top_leaks = sorted(leaks, key=lambda row: -row["saved"])[:5]
    option_mix = {"actual": {}, "recommended": {}}
    for row in rows:
        option_mix["actual"][row["actual"]] = option_mix["actual"].get(row["actual"], 0) + 1
        option_mix["recommended"][row["recommended"]] = (
            option_mix["recommended"].get(row["recommended"], 0) + 1)

    return {
        "synthetic": True,
        "period": history["period"],
        "requests": len(rows),
        "outside_spend_actual": outside_spend,
        "outside_spend_avoided": avoided,
        "kept_pct": round(100 * avoided / outside_spend, 1) if outside_spend else 0,
        "leaks": len(leaks),
        "changed_decisions": sum(1 for row in rows if row["actual"] != row["recommended"]),
        "option_mix": option_mix,
        "by_class": by_class,
        "top_leaks": top_leaks,
        "assumptions": ASSUMPTIONS,
    }
