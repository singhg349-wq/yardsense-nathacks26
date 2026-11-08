"""Exact static group assignment with PuLP, compared with a greedy assignment.

The model answers: given every future equipment request at once, which physical
unit (or outside rental / purchase) minimizes total group cost?

It is deliberately a static snapshot. The shipped engine is the dynamic greedy
allocator: it reserves units as it walks the plan and lets purchases create new
units. This module is the technical comparison, not a replacement for the
engine plan. Both baselines use the same request set, candidate units and costs.
"""
import time
from datetime import date

import pulp

from . import allocator, availability, cost_model
from .allocator import OWNED_BY_RENTALS

ASSUMPTIONS = [
    "Static snapshot: every future request is assigned at once.",
    "A unit's origin is its site before the plan; relocation after a move is not re-priced.",
    "A unit can serve non-overlapping requests; overlapping requests are mutually exclusive.",
    "Buy is offered only when no owned or sister unit is available for that request.",
    "The shipped plan is the dynamic greedy allocator; this is a comparison, not the live plan.",
]


def _pipeline(world, asset_class):
    spans = []
    for project in world["projects"]:
        for need in project["planned_equipment"]:
            if need["class"] == asset_class:
                span = (date.fromisoformat(need["start"]), date.fromisoformat(need["finish"]))
                spans.extend([span] * need["qty"])
    return spans


def _requests(world):
    """Split every future need into one request per physical unit."""
    today = date.fromisoformat(world["settings"]["demo_today"])
    requests = []
    for project in world["projects"]:
        for index, need in enumerate(project["planned_equipment"]):
            start = date.fromisoformat(need["start"])
            finish = date.fromisoformat(need["finish"])
            if start < today:
                continue
            for unit_index in range(need["qty"]):
                requests.append({
                    "request_id": f"{project['id']}:{index}:{unit_index}",
                    "project_id": project["id"],
                    "site_id": project["site_id"],
                    "class": need["class"],
                    "qty": 1,
                    "start": start,
                    "finish": finish,
                    "days": cost_model.days_between(start, finish),
                })
    requests.sort(key=lambda row: (row["start"], row["project_id"], row["request_id"]))
    return requests


def _dest(world, request):
    site = next(site for site in world["sites"] if site["id"] == request["site_id"])
    return site["lat"], site["lon"]


def _candidates(world, request, settings, road_distances):
    """Every unit that can physically serve this request, with its group cost."""
    units = availability.available_units(world, request["start"], request["finish"],
                                         request["class"])
    cls = world["classes"][request["class"]]
    dest = _dest(world, request)
    priced_request = {**request, "dest": dest, "qty": 1}
    rows = []
    for unit in units:
        km = cost_model.move_km(unit, priced_request, settings, road_distances)
        truck = cost_model.transport_cost(km, settings)
        wear = cls["wear_per_day"] * request["days"]
        rows.append({**unit, "km": km, "transport": truck, "wear": wear,
                     "group_cost": round(truck + wear, 2)})
    return rows


def _outside_cost(world, request):
    cls = world["classes"][request["class"]]
    return round(cost_model.rental_price(request["days"], cls["outside"])
                 + cls["outside_delivery_fee"], 2)


def _buy_cost(world, request, settings, road_distances):
    """Buy group cost, only when no owned or sister unit is a candidate."""
    cls = world["classes"][request["class"]]
    priced_request = {**request, "dest": _dest(world, request), "qty": 1}
    options = cost_model.price_options(
        priced_request, cls, settings, [], [],
        _pipeline(world, request["class"]), road_distances)
    buy = next(option for option in options if option["option"] == "buy")
    return round(buy["group_cost"], 2) if buy["available"] else None


def _overlap(first, second):
    return first["start"] <= second["finish"] and second["start"] <= first["finish"]


def _greedy_static(requests, candidates, outside, buy):
    """Greedy under the same static model, for an apples-to-apples baseline."""
    busy = {}  # unit_id -> list of assigned request rows
    total = 0.0
    mix = {"move_ours": 0, "rent_sister": 0, "rent_outside": 0, "buy": 0}
    for request in requests:
        feasible = [unit for unit in candidates[request["request_id"]]
                    if all(not _overlap(request, used) for used in busy.get(unit["asset_id"], []))]
        options = [(unit["group_cost"], "unit", unit) for unit in feasible]
        if buy[request["request_id"]] is not None:
            options.append((buy[request["request_id"]], "buy", None))
        options.append((outside[request["request_id"]], "outside", None))
        cost, kind, unit = min(options, key=lambda entry: entry[0])
        total += cost
        if kind == "unit":
            busy.setdefault(unit["asset_id"], []).append(request)
            mix["rent_sister" if unit["company"] == OWNED_BY_RENTALS else "move_ours"] += 1
        else:
            mix["buy" if kind == "buy" else "rent_outside"] += 1
    return {"group_cost": round(total, 2), "option_mix": mix, "requests": len(requests)}


def compare(world):
    """Solve the static assignment and compare it with the greedy baselines."""
    settings = world["settings"]
    road_distances = world.get("road_distances")
    requests = _requests(world)
    candidates = {row["request_id"]: _candidates(world, row, settings, road_distances)
                  for row in requests}
    outside = {row["request_id"]: _outside_cost(world, row) for row in requests}
    buy = {}
    for row in requests:
        buy[row["request_id"]] = (None if candidates[row["request_id"]]
                                  else _buy_cost(world, row, settings, road_distances))

    started = time.perf_counter()
    problem = pulp.LpProblem("yardsense_static_assignment", pulp.LpMinimize)
    use = {}
    for request in requests:
        rid = request["request_id"]
        for unit in candidates[rid]:
            use[(rid, unit["asset_id"])] = pulp.LpVariable(
                f"u_{rid}_{unit['asset_id']}".replace(":", "_").replace("-", "_"),
                cat="Binary")
        use[(rid, "outside")] = pulp.LpVariable(f"o_{rid}".replace(":", "_"), cat="Binary")
        if buy[rid] is not None:
            use[(rid, "buy")] = pulp.LpVariable(f"b_{rid}".replace(":", "_"), cat="Binary")

    problem += pulp.lpSum(
        cost * use[key]
        for request in requests
        for key, cost in _cost_entries(request, candidates, outside, buy))

    for request in requests:
        rid = request["request_id"]
        keys = [(rid, unit["asset_id"]) for unit in candidates[rid]] + [(rid, "outside")]
        if buy[rid] is not None:
            keys.append((rid, "buy"))
        problem += pulp.lpSum(use[key] for key in keys) == 1

    for unit_id in {unit["asset_id"] for row in candidates.values() for unit in row}:
        involving = [request for request in requests
                     if any(unit["asset_id"] == unit_id for unit in candidates[request["request_id"]])]
        for index, first in enumerate(involving):
            for second in involving[index + 1:]:
                if _overlap(first, second):
                    problem += (use[(first["request_id"], unit_id)]
                                + use[(second["request_id"], unit_id)] <= 1)

    solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=60)
    problem.solve(solver)
    runtime_ms = round((time.perf_counter() - started) * 1000, 1)

    mix = {"move_ours": 0, "rent_sister": 0, "rent_outside": 0, "buy": 0}
    total = 0.0
    for request in requests:
        rid = request["request_id"]
        chosen = [(key, variable) for key, variable in use.items()
                  if key[0] == rid and variable.value() and variable.value() > 0.5]
        if not chosen:
            continue
        key = chosen[0][0]
        if key[1] == "outside":
            total += outside[rid]
            mix["rent_outside"] += 1
        elif key[1] == "buy":
            total += buy[rid]
            mix["buy"] += 1
        else:
            unit = next(unit for unit in candidates[rid] if unit["asset_id"] == key[1])
            total += unit["group_cost"]
            mix["rent_sister" if unit["company"] == OWNED_BY_RENTALS else "move_ours"] += 1

    greedy_static = _greedy_static(requests, candidates, outside, buy)
    engine_plan = allocator.build_plan(world)
    engine_mix = {"move_ours": 0, "rent_sister": 0, "rent_outside": 0, "buy": 0}
    for row in engine_plan:
        engine_mix[row["option"]] += row["qty"]
    engine_greedy = {"group_cost": round(sum(row["group_cost"] for row in engine_plan), 2),
                     "option_mix": engine_mix,
                     "requests": sum(row["qty"] for row in engine_plan)}

    delta = round(greedy_static["group_cost"] - total, 2)
    return {
        "as_of": settings["demo_today"],
        "requests": len(requests),
        "status": pulp.LpStatus[problem.status],
        "runtime_ms": runtime_ms,
        "greedy_static": greedy_static,
        "mincost": {"group_cost": round(total, 2), "option_mix": mix,
                    "requests": len(requests)},
        "engine_greedy": engine_greedy,
        "delta": {
            "group_cost": delta,
            "pct": round(100 * delta / greedy_static["group_cost"], 1)
            if greedy_static["group_cost"] else 0,
        },
        "assumptions": ASSUMPTIONS,
    }


def _cost_entries(request, candidates, outside, buy):
    rid = request["request_id"]
    for unit in candidates[rid]:
        yield (rid, unit["asset_id"]), unit["group_cost"]
    yield (rid, "outside"), outside[rid]
    if buy[rid] is not None:
        yield (rid, "buy"), buy[rid]
