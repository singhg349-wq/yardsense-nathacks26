"""Suggest a re-plan of open requests, net of the cost of switching.

The live plan stays greedy. This module only answers: if we re-solved every
request that has not started yet with the exact min-cost model, how much would
we save after paying to undo the choices already in the plan?

Both sides use the static model from ``mincost`` so the comparison is
apples-to-apples: "greedy" is the earliest-first greedy priced under that
model (the same baseline /mincost reports), and "re-plan" is the CBC solution
with every already-started request pinned to its greedy choice.
"""
from datetime import date

from . import cost_model, mincost
from .allocator import OWNED_BY_RENTALS

# ASSUMPTION: flat admin / cancellation fee for changing a booking that has no
# truck move to undo (an outside rental, a purchase, or a unit already on
# site). Not sourced; a placeholder until a real fee schedule is available.
SWITCH_FEE = 150.0

ASSUMPTIONS = [
    "Locked: any request whose start date is on or before the demo date cannot change.",
    "Greedy and re-plan are both priced under the static /mincost model.",
    "Switching a unit that was due to move costs one extra truck move "
    "(same transport cost function as the plan).",
    f"Switching anything else costs a flat ${SWITCH_FEE:,.0f} admin/cancellation fee (assumed).",
    "Suggestion only: the live plan does not change until a planner accepts it.",
]


def _option(key, candidates):
    if key in ("outside", "buy"):
        return "rent_outside" if key == "outside" else "buy"
    unit = next(unit for unit in candidates if unit["asset_id"] == key)
    return "rent_sister" if unit["company"] == OWNED_BY_RENTALS else "move_ours"


def _cost(key, rid, candidates, outside, buy):
    if key == "outside":
        return outside[rid]
    if key == "buy":
        return buy[rid]
    return next(unit for unit in candidates[rid] if unit["asset_id"] == key)["group_cost"]


def _switching_cost(key, candidates, settings):
    """Cost of undoing the greedy choice ``key`` for one request."""
    if key not in ("outside", "buy"):
        unit = next(unit for unit in candidates if unit["asset_id"] == key)
        if unit["km"] > 0:
            return round(cost_model.transport_cost(unit["km"], settings), 2)
    return SWITCH_FEE


def _locked_count(world, today):
    return sum(need["qty"] for project in world["projects"]
               for need in project["planned_equipment"]
               if date.fromisoformat(need["start"]) <= today)


def suggest(world):
    """Compare the greedy plan with a re-solve of the open requests."""
    settings = world["settings"]
    today = date.fromisoformat(settings["demo_today"])
    requests, candidates, outside, buy = mincost._inputs(world)
    greedy, greedy_choices = mincost._greedy_static_choices(requests, candidates, outside, buy)

    locked = {row["request_id"] for row in requests if row["start"] <= today}
    fixed = {rid: greedy_choices[rid] for rid in locked}
    status, runtime_ms, choices = mincost.solve(requests, candidates, outside, buy, fixed)

    names = {project["id"]: project["name"] for project in world["projects"]}
    replan_cost = 0.0
    # Group the per-unit requests back into needs ("project:index"). Units of
    # one need are interchangeable, so swapping which unit index gets which
    # choice is not a change.
    needs = {}
    for request in requests:
        rid = request["request_id"]
        new_key = choices.get(rid, greedy_choices[rid])
        replan_cost += _cost(new_key, rid, candidates, outside, buy)
        if rid in locked:
            continue
        need_id = rid.rsplit(":", 1)[0]
        entry = needs.setdefault(need_id, {"request": request, "old": [], "new": []})
        entry["old"].append(greedy_choices[rid])
        entry["new"].append(new_key)

    switching = 0.0
    changes = []
    for need_id, entry in needs.items():
        old_keys, new_keys = list(entry["old"]), []
        for key in entry["new"]:
            if key in old_keys:
                old_keys.remove(key)
            else:
                new_keys.append(key)
        request = entry["request"]
        rid = request["request_id"]
        for old_key, new_key in zip(old_keys, new_keys):
            new_cost = _cost(new_key, rid, candidates, outside, buy)
            old_cost = _cost(old_key, rid, candidates, outside, buy)
            fee = _switching_cost(old_key, candidates[rid], settings)
            switching += fee
            changes.append(_change(need_id, request, names, old_key, new_key,
                                   candidates[rid], old_cost - new_cost, fee))

    greedy_cost = greedy["group_cost"]
    replan_cost = round(replan_cost, 2)
    switching = round(switching, 2)
    net = round(greedy_cost - replan_cost - switching, 2)
    return {
        "as_of": settings["demo_today"],
        "status": status,
        "runtime_ms": runtime_ms,
        "requests": len(requests),
        "greedy_cost": greedy_cost,
        "replan_cost": replan_cost,
        "switching_cost": switching,
        "net_saving": net,
        "locked_count": _locked_count(world, today),
        "changes": changes,
        "recommend": net > 0,
        "assumptions": ASSUMPTIONS,
    }


def _change(need_id, request, names, old_key, new_key, candidates, saving, fee):
    return {
        "request_id": need_id,
        "project_id": request["project_id"],
        "project": names.get(request["project_id"], request["project_id"]),
        "class": request["class"],
        "start": request["start"].isoformat(),
        "from_option": _option(old_key, candidates),
        "to_option": _option(new_key, candidates),
        "from_asset": None if old_key in ("outside", "buy") else old_key,
        "to_asset": None if new_key in ("outside", "buy") else new_key,
        "saving": round(saving, 2),
        "switching_cost": fee,
    }
