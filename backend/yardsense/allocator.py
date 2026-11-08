"""Greedy group plan with exclusive reservations for physical units."""

from copy import deepcopy
from datetime import date, timedelta

from . import availability, cost_model

OWNED_BY_RENTALS = "NR01"


def shifted_world(world, shifts):
    """Return a copy with project, phase, and equipment dates shifted together."""
    result = deepcopy(world)
    projects = {project["id"]: project for project in result["projects"]}
    for shift in shifts:
        project = projects.get(shift["project_id"])
        if project is None:
            raise ValueError(f"Unknown project: {shift['project_id']}")
        delta = timedelta(days=shift["days"])
        for key in ("start_date", "completion_date"):
            project[key] = (date.fromisoformat(project[key]) + delta).isoformat()
        for phase in project["phases"]:
            for key in ("start", "finish"):
                phase[key] = (date.fromisoformat(phase[key]) + delta).isoformat()
        for need in project["planned_equipment"]:
            for key in ("start", "finish"):
                need[key] = (date.fromisoformat(need[key]) + delta).isoformat()
    return result


def _pipeline(world, asset_class):
    spans = []
    for project in world["projects"]:
        for need in project["planned_equipment"]:
            if need["class"] == asset_class:
                span = (date.fromisoformat(need["start"]),
                        date.fromisoformat(need["finish"]))
                spans.extend([span] * need["qty"])
    return spans


def _candidates(world, request, reservations, purchases, sites):
    """Remove already booked units and move released ones to their last planned site."""
    units = availability.available_units(world, request["start"], request["finish"],
                                          request["class"])
    units.extend(unit for unit in purchases
                 if unit["asset_class"] == request["class"]
                 and unit["acquired_on"] <= request["start"])
    eligible = []
    for unit in units:
        bookings = reservations.get(unit["asset_id"], [])
        if any(a <= request["finish"] and b >= request["start"]
               for a, b, _ in bookings):
            continue
        previous = [booking for booking in bookings if booking[1] < request["start"]]
        if previous:
            _, _, site_id = max(previous, key=lambda booking: booking[1])
            site = sites[site_id]
            unit = {**unit, "site_id": site_id, "lat": site["lat"],
                    "lon": site["lon"], "where": f"at {site['name']}"}
        eligible.append(unit)
    return eligible


def build_plan(world):
    """Allocate earliest needs first, choosing the cheapest feasible group option."""
    today = date.fromisoformat(world["settings"]["demo_today"])
    sites = {site["id"]: site for site in world["sites"]}
    requests = []
    for project in world["projects"]:
        for index, need in enumerate(project["planned_equipment"]):
            start = date.fromisoformat(need["start"])
            finish = date.fromisoformat(need["finish"])
            # Ongoing work is already represented by the check-out log.
            if start < today:
                continue
            requests.append({"request_id": f"{project['id']}:{index}",
                             "project_id": project["id"], "site_id": project["site_id"],
                             "class": need["class"], "qty": need["qty"],
                             "start": start, "finish": finish})
    requests.sort(key=lambda req: (req["start"], req["project_id"], req["request_id"]))

    reservations = {}
    purchases = []
    allocations = []
    for request in requests:
        site = sites[request["site_id"]]
        candidates = _candidates(world, request, reservations, purchases, sites)
        quoted = cost_model.price_options(
            {**request, "dest": (site["lat"], site["lon"])},
            world["classes"][request["class"]], world["settings"],
            [unit for unit in candidates if unit["company"] != OWNED_BY_RENTALS],
            [unit for unit in candidates if unit["company"] == OWNED_BY_RENTALS],
            _pipeline(world, request["class"]))
        options = cost_model.rank(quoted)
        chosen = options[0]
        asset_ids = chosen.get("asset_ids", [])
        if chosen["option"] == "buy":
            # A purchase creates one new sister-company unit for later requests.
            asset_ids = []
            for _ in range(request["qty"]):
                asset_id = f"BUY-{request['class']}-{len(purchases) + 1}"
                purchases.append({"asset_id": asset_id, "asset_class": request["class"],
                                  "company": OWNED_BY_RENTALS, "acquired_on": request["start"],
                                  "site_id": request["site_id"], "lat": site["lat"],
                                  "lon": site["lon"], "where": f"at {site['name']}"})
                asset_ids.append(asset_id)
        for asset_id in asset_ids:
            reservations.setdefault(asset_id, []).append(
                (request["start"], request["finish"], request["site_id"]))
        allocations.append({**request, "start": request["start"].isoformat(),
                            "finish": request["finish"].isoformat(),
                            "option": chosen["option"], "asset_ids": asset_ids,
                            "moves": chosen.get("moves", []),
                            "project_cost": chosen["project_cost"],
                            "group_cost": chosen["group_cost"],
                            "kept_in_group": chosen["kept_in_group"],
                            "reason": chosen["reason"], "options": options})
    return allocations


def request_allocations(world, project_id, items):
    """Find each request in the shared plan, adding new needs when necessary."""
    planning_world = deepcopy(world)
    project = next(p for p in planning_world["projects"] if p["id"] == project_id)
    needs = project["planned_equipment"]
    used = set()
    request_ids = []
    for item in items:
        match = next((index for index, need in enumerate(needs)
                      if index not in used and need["class"] == item["class"]
                      and need["qty"] == item.get("qty", 1)
                      and need["start"] == item["start"]
                      and need["finish"] == item["finish"]), None)
        if match is None:
            match = len(needs)
            needs.append({"class": item["class"], "qty": item.get("qty", 1),
                          "start": item["start"], "finish": item["finish"],
                          "phase": None})
        used.add(match)
        request_ids.append(f"{project_id}:{match}")
    plan = {row["request_id"]: row for row in build_plan(planning_world)}
    return [plan.get(request_id) for request_id in request_ids]


def replan(world, shifts):
    """Return the shifted plan and which choices changed from the baseline."""
    baseline = build_plan(world) if shifts else []
    shifted = shifted_world(world, shifts)
    allocations = build_plan(shifted)
    before = {row["request_id"]: row for row in baseline}
    changed = []
    for row in allocations:
        old = before.get(row["request_id"])
        if old and old["option"] != row["option"]:
            changed.append({"request_id": row["request_id"],
                            "project_id": row["project_id"], "class": row["class"],
                            "from_option": old["option"], "to_option": row["option"]})
    return {"projects": shifted["projects"], "allocations": allocations,
            "changed": changed,
            "totals": {"group_cost": round(sum(row["group_cost"] for row in allocations), 2),
                       "kept_in_group": round(sum(row["kept_in_group"] for row in allocations), 2)}}
