"""Greedy group plan with exclusive reservations for physical units."""

from copy import deepcopy
from datetime import date, timedelta

from . import availability, cost_model

OWNED_BY_RENTALS = "NR01"
SOURCE_NAMES = {"move_ours": "move ours", "rent_sister": "rent from sister",
                "rent_outside": "rent outside", "buy": "buy"}


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


def _source(unit):
    return "rent_sister" if unit["company"] == OWNED_BY_RENTALS else "move_ours"


def _quote(request, cls, settings, owned, sister, pipeline, road_distances, qty, supply=0):
    """Price the four options for ``qty`` units of the request, keyed by name."""
    options = cost_model.price_options({**request, "qty": qty}, cls, settings, owned,
                                       sister, pipeline, road_distances, supply)
    return {option["option"]: option for option in options}


def _part(option, qty):
    """One source inside a (possibly split) choice."""
    fields = ("option", "project_cost", "group_cost", "reason", "breakdown",
              "breakeven_month", "net_annual_impact", "marginal_units", "owning_cost",
              "owning_remainder", "owning_shares", "group_breakdown")
    return {"qty": qty, **{key: option[key] for key in fields if key in option},
            "asset_ids": list(option.get("asset_ids", [])),
            "moves": list(option.get("moves", []))}


def split_option(request, cls, settings, candidates, pipeline, road_distances, outside_cost,
                 supply=0):
    """Partial fill: cheapest idle units first, the remainder rented outside or bought.

    Returns None when the best mix uses a single source (the normal options
    already cover that). Units are taken in order of their own group cost
    (truck + wear). Buy is offered for the remainder only once every idle unit
    is used, the same rule the single options follow.
    """
    qty = request["qty"]
    if qty < 2 or not candidates:
        return None
    days = cost_model.days_between(request["start"], request["finish"])
    ranked = []
    for unit in candidates:
        km = cost_model.move_km(unit, request, settings, road_distances)
        ranked.append((cost_model.transport_cost(km, settings) + cls["wear_per_day"] * days,
                       km, unit["asset_id"], unit))
    ranked.sort(key=lambda row: row[:3])

    best = None
    for taken in range(1, min(qty, len(ranked)) + 1):
        units = [row[3] for row in ranked[:taken]]
        parts = []
        for source in ("move_ours", "rent_sister"):
            group = [unit for unit in units if _source(unit) == source]
            if group:
                quoted = _quote(request, cls, settings,
                                group if source == "move_ours" else [],
                                group if source == "rent_sister" else [],
                                pipeline, road_distances, len(group))
                parts.append(_part(quoted[source], len(group)))
        remainder = qty - taken
        if remainder:
            quoted = _quote(request, cls, settings, [], [], pipeline, road_distances,
                            remainder, supply)
            choices = [quoted["rent_outside"]]
            if quoted["buy"]["available"] and taken == len(ranked):
                choices.append(quoted["buy"])
            parts.append(_part(min(choices, key=lambda option: option["group_cost"]), remainder))
        total = sum(part["group_cost"] for part in parts)
        if best is None or total < best[0] - 0.005:
            best = (total, taken, parts)

    total, taken, parts = best
    if len(parts) < 2:
        return None
    mix = " + ".join(f"{part['qty']} x {SOURCE_NAMES[part['option']]}" for part in parts)
    if taken < qty:
        rest = parts[-1]
        reason = (f"Split {mix}: only {taken} of {qty} {cls['label']} idle in the group. "
                  f"{SOURCE_NAMES[rest['option']].capitalize()} the rest: {rest['reason']}")
    else:
        reason = f"Split {mix}: the cheapest idle {cls['label']} from each source."
    group_cost = round(total, 2)
    return {"option": "split", "available": True,
            "project_cost": round(sum(part["project_cost"] for part in parts), 2),
            "group_cost": group_cost,
            "kept_in_group": round(outside_cost - group_cost, 2),
            "reason": reason,
            "breakdown": [{"label": f"{part['qty']} x {SOURCE_NAMES[part['option']]}: "
                                    f"{line['label'].lower()}",
                           "amount": line["amount"]}
                          for part in parts for line in part["breakdown"]],
            "asset_ids": [asset for part in parts for asset in part["asset_ids"]],
            "moves": [move for part in parts for move in part["moves"]],
            "units": parts}


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
        priced = {**request, "dest": (site["lat"], site["lon"])}
        cls = world["classes"][request["class"]]
        pipeline = _pipeline(world, request["class"])
        # An extra unit is judged against every usable group unit plus the ones
        # this plan has already bought (the fleet advisor's supply).
        supply = availability.usable_supply(world, request["class"]) + sum(
            1 for unit in purchases if unit["asset_class"] == request["class"])
        quoted = cost_model.price_options(
            priced, cls, world["settings"],
            [unit for unit in candidates if unit["company"] != OWNED_BY_RENTALS],
            [unit for unit in candidates if unit["company"] == OWNED_BY_RENTALS],
            pipeline, world.get("road_distances"), supply)
        options = cost_model.rank(quoted)
        outside = next(option for option in quoted if option["option"] == "rent_outside")
        split = split_option(priced, cls, world["settings"], candidates, pipeline,
                             world.get("road_distances"), outside["group_cost"], supply)
        # A split is offered only when it beats every single-source option.
        if split and split["group_cost"] < options[0]["group_cost"] - 0.005:
            options = [split] + options
        chosen = options[0]
        units = deepcopy(chosen.get("units") or [_part(chosen, request["qty"])])
        for part in units:
            if part["option"] == "buy":
                # A purchase creates new sister-company units for later requests.
                part["asset_ids"] = []
                shares = part.get("owning_shares") or [0.0] * part["qty"]
                for index in range(part["qty"]):
                    asset_id = f"BUY-{request['class']}-{len(purchases) + 1}"
                    purchases.append({"asset_id": asset_id, "asset_class": request["class"],
                                      "company": OWNED_BY_RENTALS,
                                      "acquired_on": request["start"],
                                      "site_id": request["site_id"], "lat": site["lat"],
                                      "lon": site["lon"], "where": f"at {site['name']}",
                                      "quoted_share": shares[index]})
                    part["asset_ids"].append(asset_id)
        asset_ids = [asset for part in units for asset in part["asset_ids"]]
        for asset_id in asset_ids:
            reservations.setdefault(asset_id, []).append(
                (request["start"], request["finish"], request["site_id"]))
        allocations.append({**request, "start": request["start"].isoformat(),
                            "finish": request["finish"].isoformat(),
                            "option": chosen["option"], "asset_ids": asset_ids,
                            "moves": chosen.get("moves", []),
                            # Per-source breakdown; one entry unless the need is split.
                            "units": [{"option": part["option"], "qty": part["qty"],
                                       "asset_ids": part["asset_ids"],
                                       "group_cost": part["group_cost"]} for part in units],
                            "project_cost": chosen["project_cost"],
                            "group_cost": chosen["group_cost"],
                            "kept_in_group": chosen["kept_in_group"],
                            "reason": chosen["reason"], "options": options,
                            "outside_group_cost": outside["group_cost"]})
    _settle_owning_cost(world, allocations, purchases, today)
    for row in allocations:
        row.pop("outside_group_cost")
    return allocations


def _settle_owning_cost(world, allocations, purchases, today):
    """Charge each bought unit's full year of owning cost across the rows that use it.

    A row's share = its days in the 12-month horizon / every day the plan
    reserves that unit there. The buying row's quote used the unit's expected
    marginal days; here it is replaced by the share of the days actually
    planned, and later rows that reuse the unit pay their share on top of truck
    and wear. The plan total therefore includes exactly one year of cost to own
    per purchase, never less.
    """
    end = today + timedelta(days=cost_model.HORIZON_DAYS - 1)
    for unit in purchases:
        own = cost_model.cost_to_own(world["classes"][unit["asset_class"]])
        users = [row for row in allocations if unit["asset_id"] in row["asset_ids"]]
        days = [cost_model._clip_days(date.fromisoformat(row["start"]),
                                      date.fromisoformat(row["finish"]), today, end)
                for row in users]
        total = sum(days)
        for row, used in zip(users, days):
            share = cost_model.owning_share(used, total) if total else (
                1.0 if row is users[0] else 0.0)
            charge = round(own * share, 2)
            part = next(part for part in row["units"] if unit["asset_id"] in part["asset_ids"])
            # The buying row swaps its quoted share for the settled one.
            delta = charge - (unit["quoted_share"] if row is users[0] else 0.0)
            part["group_cost"] = round(part["group_cost"] + delta, 2)
            row["group_cost"] = round(row["group_cost"] + delta, 2)
            row["kept_in_group"] = round(row["outside_group_cost"] - row["group_cost"], 2)
            row.setdefault("owning_charges", []).append(
                {"asset_id": unit["asset_id"], "days": used, "unit_days": total,
                 "amount": charge})


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


def _mix(row):
    """A choice ignoring which physical units: the option plus its split parts."""
    return row["option"], sorted((part["option"], part["qty"]) for part in row["units"])


def replan(world, shifts):
    """Return the shifted plan and which choices changed from the baseline."""
    baseline = build_plan(world) if shifts else []
    shifted = shifted_world(world, shifts)
    allocations = build_plan(shifted)
    before = {row["request_id"]: row for row in baseline}
    changed = []
    for row in allocations:
        old = before.get(row["request_id"])
        if old and _mix(old) != _mix(row):
            changed.append({"request_id": row["request_id"],
                            "project_id": row["project_id"], "class": row["class"],
                            "from_option": old["option"], "to_option": row["option"]})
    return {"projects": shifted["projects"], "allocations": allocations,
            "changed": changed,
            "totals": {"group_cost": round(sum(row["group_cost"] for row in allocations), 2),
                       "kept_in_group": round(sum(row["kept_in_group"] for row in allocations), 2)}}
