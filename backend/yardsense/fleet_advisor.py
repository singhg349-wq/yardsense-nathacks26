"""Rule-based fleet advice for the Northgate Group from the forward pipeline.

The advisor is deliberately simple and explainable. Every item returns the
rule it used, the peak demand, the usable supply and the money each extra
unit would make or lose, so a judge can check the call by hand.

Two ideas keep the math honest:

* Supply is every group unit (all companies) except units on open-ended
  outside hire in the check-out log. Units on an internal project count,
  because that project's need is part of the pipeline they serve.
* Each additional unit is judged on its own marginal demand. The k-th extra
  unit only works on days when more than supply + k - 1 units are needed at
  the same time, so overlapping needs are never all credited to one unit.
"""
from datetime import date, timedelta

from . import allocator, availability, cost_model

HORIZON_DAYS = cost_model.HORIZON_DAYS
HORIZON_MONTHS = cost_model.HORIZON_MONTHS
MAX_ADD = 2

RULES = [
    "Peak demand is the highest concurrent quantity of that class planned in the next 12 months.",
    "Supply counts units from every group company, minus units on open-ended outside hire in the check-out log.",
    "Each extra unit is priced on its own demand: the k-th unit only covers days when more than supply + k - 1 units are needed at once.",
    "Rent avoided is the outside rental (cheapest month/week/day mix plus delivery) for each run of days that unit would cover.",
    "Cost to own for a year is one year of depreciation (purchase price x yearly resale loss) plus 12 months of maintenance and insurance.",
    "Net annual impact = rent avoided - cost to own. Add a unit only when its net annual impact is positive.",
    "Break-even = purchase price / monthly net saving; a unit with no net saving does not pay back.",
    "Retire only units that are idle today (not on any hire) and surplus to peak demand. Retiring saves 12 months of maintenance and insurance.",
    "When the live plan buys units of a class the advisor would not add, the reason says so and gives one unit's net.",
]


def _active_by_day(world, asset_class, today, end):
    """Concurrent planned quantity of this class for each day in the horizon."""
    return cost_model.demand_by_day(allocator._pipeline(world, asset_class), today,
                                    (end - today).days + 1)


# The money case for one extra unit lives in cost_model, so the per-request buy
# test and this advisor use exactly the same numbers.
carrying_cost = cost_model.carrying_cost
cost_to_own = cost_model.cost_to_own
breakeven_months = cost_model.breakeven_months
marginal_unit = cost_model.marginal_unit
_on_outside_hire = availability.on_outside_hire


def _plan_purchases(plan):
    """Units the live plan buys per class, including the bought part of a split."""
    counts = {}
    for row in plan:
        for part in row.get("units") or [row]:
            if part["option"] == "buy":
                counts[row["class"]] = counts.get(row["class"], 0) + len(part["asset_ids"])
    return counts


def advise(world, plan=None):
    """Add / retire / hold calls for every equipment class.

    `plan` is the live allocator plan; it is built when not given, so the
    advisor can explain where it disagrees with a purchase the plan makes.
    """
    today = date.fromisoformat(world["settings"]["demo_today"])
    end = today + timedelta(days=HORIZON_DAYS - 1)
    if plan is None:
        plan = allocator.build_plan(world)
    purchases = _plan_purchases(plan)
    outside_hire = _on_outside_hire(world)
    names = {company["code"]: company["name"] for company in world.get("companies", [])}
    items = []

    for code, rates in sorted(world["classes"].items()):
        units = [asset for asset in world["assets"] if asset["asset_class"] == code]
        hired_out = [asset for asset in units if asset["asset_id"] in outside_hire]
        supply = len(units) - len(hired_out)
        idle = sorted(availability.available_units(world, today, today, code),
                      key=lambda unit: (unit["company"] != "NR01", unit["asset_id"]))
        active = _active_by_day(world, code, today, end)
        peak = max(active, default=0)
        pipeline_days = sum(active)
        unmet_unit_days = sum(max(0, quantity - supply) for quantity in active)
        utilization = (round(100 * pipeline_days / (supply * HORIZON_DAYS), 1)
                       if supply else None)
        by_company = {}
        for asset in units:
            by_company[asset["company"]] = by_company.get(asset["company"], 0) + 1

        marginal = [marginal_unit(rates, active, supply, k)
                    for k in range(1, max(0, peak - supply) + 1)]
        next_unit = marginal[0] if marginal else None
        action, quantity, breakeven, impact = "hold", 0, None, 0.0
        retire_ids = []
        context = (f"Peak demand {peak} against {supply} usable "
                   f"({len(units)} in the group, {len(hired_out)} on outside hire).")

        if peak > supply:
            paying = []
            for unit in marginal[:MAX_ADD]:
                if unit["net_annual_impact"] <= 0:
                    break
                paying.append(unit)
            if paying:
                action = "add"
                quantity = len(paying)
                impact = round(sum(unit["net_annual_impact"] for unit in paying), 2)
                breakeven = breakeven_months(rates, impact / quantity)
                last = paying[-1]
                reason = (f"{context} Unit {last['unit']} covers {last['days']} days and nets "
                          f"${last['net_annual_impact']:,.0f}/yr after owning cost.")
            else:
                reason = (f"{context} The next unit would cover {next_unit['days']} days, saving "
                          f"${next_unit['rent_avoided']:,.0f} against ${next_unit['cost_to_own']:,.0f} "
                          f"to own for a year, so renting the overflow outside is cheaper.")
        elif supply > peak and idle:
            action = "retire"
            quantity = min(supply - peak, len(idle))
            retire_ids = [unit["asset_id"] for unit in idle[:quantity]]
            impact = round(quantity * carrying_cost(rates), 2)
            first = idle[0]
            reason = (f"{context} Unit {', '.join(retire_ids)} "
                      f"({names.get(first['company'], first['company'])}) is idle {first['where']} "
                      f"and the remaining units cover the peak.")
        elif supply > peak:
            reason = (f"{context} Supply exceeds peak, but every unit is on hire today, "
                      f"so there is nothing idle to retire.")
        else:
            reason = f"{context} Supply matches peak demand."

        bought = purchases.get(code, 0)
        if bought and action != "add":
            net = next_unit["net_annual_impact"] if next_unit else -cost_to_own(rates)
            reason += (f" The live plan buys {bought} to fill individual requests; judged on its "
                       f"own 12-month demand, one more unit nets "
                       f"{'-' if net < 0 else ''}${abs(net):,.0f}/yr, so this view does not "
                       f"recommend growing the fleet.")

        items.append({
            "class": code,
            "label": rates["label"],
            "owned": len(units),
            "by_company": by_company,
            "on_outside_hire": len(hired_out),
            "supply": supply,
            "idle_now": len(idle),
            "peak_units": peak,
            "pipeline_days": pipeline_days,
            "unmet_unit_days": unmet_unit_days,
            "utilization_pct": utilization,
            "action": action,
            "quantity": quantity,
            "retire_asset_ids": retire_ids,
            "breakeven_month": breakeven,
            "annual_impact": impact,
            "next_unit": next_unit,
            "marginal_units": marginal,
            "plan_purchases": bought,
            "reason": reason,
        })

    order = {"add": 0, "retire": 1, "hold": 2}
    items.sort(key=lambda item: (order[item["action"]], -item["annual_impact"], item["class"]))
    return {
        "as_of": today.isoformat(),
        "horizon_months": HORIZON_MONTHS,
        "rules": RULES,
        "items": items,
        "total_annual_impact": round(sum(item["annual_impact"] for item in items), 2),
    }
