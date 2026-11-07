"""Projected fleet utilization over the next twelve weeks."""

from datetime import date, timedelta

from .availability import available_units


def dashboard_metrics(world, allocations, weeks=12):
    today = date.fromisoformat(world["settings"]["demo_today"])
    days = weeks * 7
    assets = {asset["asset_id"]: asset for asset in world["assets"]}
    reservations = []
    for row in allocations:
        for asset_id in row["asset_ids"]:
            if asset_id in assets:
                reservations.append((asset_id, date.fromisoformat(row["start"]),
                                     date.fromisoformat(row["finish"])))

    idle_by_class = {code: 0 for code in world["classes"]}
    for offset in range(days):
        day = today + timedelta(days=offset)
        planned_busy = {asset_id for asset_id, start, finish in reservations
                        if start <= day <= finish}
        for unit in available_units(world, day, day):
            if unit["asset_id"] not in planned_busy:
                idle_by_class[unit["asset_class"]] += 1

    idle_days = sum(idle_by_class.values())
    fleet_days = len(assets) * days
    return {
        "horizon_start": today.isoformat(),
        "horizon_finish": (today + timedelta(days=days - 1)).isoformat(),
        "fleet_assets": len(assets),
        "fleet_days": fleet_days,
        "idle_days": idle_days,
        "utilization_pct": round(100 * (fleet_days - idle_days) / fleet_days, 1)
                           if fleet_days else 0,
        "idle_by_class": [
            {"class": code, "label": world["classes"][code]["label"], "idle_days": value}
            for code, value in sorted(idle_by_class.items(), key=lambda entry: -entry[1])
        ],
    }
