"""Synthetic 12-month replay: what the engine would have recommended last year.

The history is generated and synthetic. Whether a comparable idle group or
sister unit existed is drawn independently of the decision that was made, at a
stated base rate, so the result is not the generator's input read back out.
Idle units sit at the real group and sister yards from the seed data and are
trucked to the requesting site with the same transport cost and saved
distance matrix as the live engine.

The replay deliberately excludes the buy option: historical pipeline demand is
unknown, so comparing move / sister / outside is the defensible comparison.
Every number is an estimate, not actual performance.
"""
import json
from datetime import date

from . import cost_model
from .config import SEED_DIR

HISTORY_PATH = SEED_DIR / "backtest_history.json"

# A recommendation only counts as a change when it is at least a cent cheaper.
TIE_TOLERANCE = 0.005

OPTION_LABELS = {
    "move_ours": "Move ours",
    "rent_sister": "Rent from sister",
    "rent_outside": "Rent outside",
    "buy": "Buy",
}

ASSUMPTIONS = [
    "History is generated synthetic data, not real company records.",
    "About 1 in 5 requests had a comparable idle group or sister unit, based on industry "
    "interviews and published fleet-utilization figures. It is drawn independently of the "
    "decision that was made.",
    "Idle group units sit at the group yard and sister units at the rental yard; trucking "
    "to the site uses the saved road-distance matrix and the current truck rates.",
    "Rental days are inclusive of start and finish, as in the live cost model.",
    "A decision only changes, and a rental only counts as a leak, when the group option is "
    "strictly cheaper; ties keep the original decision.",
    "Buy is excluded because historical pipeline demand is unknown.",
    "Costs use the current rate card, not the rates charged at the time.",
    "Savings are outside rental avoided, not cash profit.",
]


def load_history(path=None):
    """Read the committed synthetic history file."""
    path = path or HISTORY_PATH
    with open(path) as handle:
        return json.load(handle)


def _yards(world):
    """(group yards, sister rental yards) from the seed sites and companies."""
    rental = {company["code"] for company in world.get("companies", [])
              if company.get("kind") == "rental"}
    yards = [site for site in world["sites"] if site.get("kind") == "yard"]
    group = [site for site in yards if site["company"] not in rental]
    sister = [site for site in yards if site["company"] in rental]
    return group, sister


def _units(prefix, request, yards):
    """Synthetic idle units for one request, `qty` of them at each yard."""
    return [{
        "asset_id": f"{prefix}-{request['id']}-{yard['id']}-{index + 1}",
        "site_id": yard["id"],
        "lat": yard["lat"],
        "lon": yard["lon"],
        "where": f"at {yard['name']}",
    } for yard in yards for index in range(request["qty"])]


def _price_request(world, request, sites, yards):
    """Rank the options for one historical request (buy excluded)."""
    group_yards, sister_yards = yards
    site = sites[request["site_id"]]
    # The unit actually used existed by definition; the other source's
    # availability is the independent draw from the history file.
    has_owned = request["internal_available"] or request["actual_option"] == "move_ours"
    has_sister = request["sister_available"] or request["actual_option"] == "rent_sister"
    owned = _units("BT-OWNED", request, group_yards) if has_owned else []
    sister = _units("BT-SISTER", request, sister_yards) if has_sister else []
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
        world.get("road_distances"),
    )
    options = [option for option in options if option["option"] != "buy"]
    return cost_model.rank(options)


def replay_request(world, request, sites=None, yards=None):
    """One replayed row: actual vs recommended option and the outside spend avoided."""
    sites = sites or {site["id"]: site for site in world["sites"]}
    yards = yards or _yards(world)
    options = _price_request(world, request, sites, yards)
    actual = next((option for option in options
                   if option["option"] == request["actual_option"] and option["available"]),
                  None)
    if actual is None:
        actual = next(option for option in options if option["option"] == "rent_outside")
    best = options[0]
    # Ties (or anything not strictly cheaper) keep the original decision.
    recommended = best if best["group_cost"] < actual["group_cost"] - TIE_TOLERANCE else actual
    saved = actual["group_cost"] - recommended["group_cost"]
    changed = recommended is not actual
    return {
        "request_id": request["id"],
        "project_name": request["project_name"],
        "class": request["class"],
        "label": world["classes"][request["class"]]["label"],
        "start": request["start"],
        "finish": request["finish"],
        "days": cost_model.days_between(date.fromisoformat(request["start"]),
                                        date.fromisoformat(request["finish"])),
        "actual": actual["option"],
        "recommended": recommended["option"],
        "actual_cost": actual["group_cost"],
        "recommended_cost": recommended["group_cost"],
        "saved": round(saved, 2),
        "changed": changed,
        "is_leak": changed and actual["option"] == "rent_outside",
        "reason": recommended["reason"],
        "from_site_ids": [move["from_site_id"] for move in recommended.get("moves", [])],
        "trucking": round(sum(move["transport_cost"] for move in recommended.get("moves", [])), 2),
    }


def run_backtest(world, history=None):
    """Replay every synthetic request and summarize the outside spend avoided."""
    history = history or load_history()
    sites = {site["id"]: site for site in world["sites"]}
    yards = _yards(world)
    rows = [replay_request(world, request, sites, yards) for request in history["requests"]]

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
    by_class.sort(key=lambda entry: (-entry["avoided"], -entry["outside_spend"], entry["class"]))

    top_leaks = sorted(leaks, key=lambda row: (-row["saved"], row["request_id"]))[:5]
    option_mix = {"actual": {}, "recommended": {}}
    for row in rows:
        option_mix["actual"][row["actual"]] = option_mix["actual"].get(row["actual"], 0) + 1
        option_mix["recommended"][row["recommended"]] = (
            option_mix["recommended"].get(row["recommended"], 0) + 1)

    return {
        "synthetic": True,
        "period": history["period"],
        "requests": len(rows),
        "outside_rentals": len(outside),
        "outside_spend_actual": outside_spend,
        "outside_spend_avoided": avoided,
        "kept_pct": round(100 * avoided / outside_spend, 1) if outside_spend else 0,
        "leaks": len(leaks),
        "changed_decisions": sum(1 for row in rows if row["changed"]),
        "option_mix": option_mix,
        "by_class": by_class,
        "top_leaks": top_leaks,
        "assumptions": ASSUMPTIONS,
    }
