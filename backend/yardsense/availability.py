"""Find units that can cover a complete requested date range."""

from datetime import date


def _assignment_end(assignment, projects, asset_class):
    """Use a project schedule when a unit has not been checked in."""
    if assignment["checked_in"]:
        return date.fromisoformat(assignment["checked_in"])
    project = projects.get(assignment["project_id"])
    if project is None:
        return None  # An outside customer keeps the unit until check-in.
    needs = [need for need in project["planned_equipment"]
             if need["class"] == asset_class]
    if not needs:
        return None  # There is no schedule evidence that the unit is free.
    end = max(date.fromisoformat(need["finish"]) for need in needs)
    if end < date.fromisoformat(assignment["checked_out"]):
        return None  # An old phase cannot release a newly checked-out unit.
    return end


def available_units(world, start, finish, asset_class=None):
    """Return units with no assignment overlapping the inclusive date range."""
    projects = {project["id"]: project for project in world["projects"]}
    sites = {site["id"]: site for site in world["sites"]}
    yards = {site["company"]: site for site in world["sites"] if site["kind"] == "yard"}
    assignments = {}
    for assignment in world["assignments"]:
        assignments.setdefault(assignment["asset_id"], []).append(assignment)

    available = []
    for asset in world["assets"]:
        if asset_class is not None and asset["asset_class"] != asset_class:
            continue
        logs = sorted(assignments.get(asset["asset_id"], []),
                      key=lambda entry: entry["checked_out"])
        busy = False
        for log in logs:
            begins = date.fromisoformat(log["checked_out"])
            ends = _assignment_end(log, projects, asset["asset_class"])
            if begins <= finish and (ends is None or ends >= start):
                busy = True
                break
        if busy:
            continue

        # An inferred release leaves the unit at its last known project site.
        previous = [log for log in logs if date.fromisoformat(log["checked_out"]) <= start]
        latest = previous[-1] if previous else None
        site = sites[latest["site_id"]] if latest and latest["checked_in"] is None else yards.get(asset["company"])
        if site is None:
            site = sites[latest["site_id"]] if latest else None
        if site is None:
            continue
        released = _assignment_end(latest, projects, asset["asset_class"]) if latest else None
        where = f"at {site['name']}"
        if released and latest["checked_in"] is None:
            where += f" since {released.strftime('%b')} {released.day}"
        available.append({**asset, "site_id": site["id"], "lat": site["lat"],
                          "lon": site["lon"], "where": where})
    return available


def on_outside_hire(world):
    """Asset ids checked out to an outside customer with no check-in date."""
    return {entry["asset_id"] for entry in world["assignments"]
            if entry["project_id"] is None and entry["checked_in"] is None}


def usable_supply(world, asset_class):
    """Group units of a class that can serve the pipeline (not on open-ended outside hire)."""
    hired_out = on_outside_hire(world)
    return sum(1 for asset in world["assets"]
               if asset["asset_class"] == asset_class and asset["asset_id"] not in hired_out)
