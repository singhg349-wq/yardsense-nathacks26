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
import math
from datetime import date, timedelta

from . import allocator, availability, cost_model

HORIZON_DAYS = 365
HORIZON_MONTHS = 12
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
    needs = [(date.fromisoformat(need["start"]), date.fromisoformat(need["finish"]), need["qty"])
             for project in world["projects"] for need in project["planned_equipment"]
             if need["class"] == asset_class]
    active = []
    day = today
    while day <= end:
        active.append(sum(qty for start, finish, qty in needs if start <= day <= finish))
        day += timedelta(days=1)
    return active


def _runs(active, level):
    """Lengths of consecutive day runs where demand reaches `level` units."""
    runs, current = [], 0
    for quantity in active + [0]:
        if quantity >= level:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    return runs


def carrying_cost(rates):
    """Twelve months of maintenance and insurance for one unit."""
    return HORIZON_MONTHS * (rates["maintenance_month"] + rates["insurance_month"])


def cost_to_own(rates):
    """One year of owning one new unit: depreciation plus carrying cost."""
    return rates["purchase_price"] * rates["resale_pct_per_year"] + carrying_cost(rates)


def breakeven_months(rates, net_annual):
    """Months for the monthly net saving to repay the purchase price, or None."""
    if net_annual <= 0:
        return None
    return math.ceil(rates["purchase_price"] / (net_annual / HORIZON_MONTHS))


def marginal_unit(rates, active, supply, k):
    """Money case for the k-th unit added on top of `supply`."""
    runs = _runs(active, supply + k)
    rent = sum(cost_model.rental_price(days, rates["outside"]) + rates["outside_delivery_fee"]
               for days in runs)
    own = cost_to_own(rates)
    net = round(rent - own, 2)
    return {"unit": k, "days": sum(runs), "rentals": len(runs),
            "rent_avoided": round(rent, 2), "cost_to_own": round(own, 2),
            "net_annual_impact": net, "breakeven_month": breakeven_months(rates, net)}


def _on_outside_hire(world):
    """Asset ids checked out to an outside customer with no check-in date."""
    return {entry["asset_id"] for entry in world["assignments"]
            if entry["project_id"] is None and entry["checked_in"] is None}


def _plan_purchases(plan):
    counts = {}
    for row in plan:
        if row["option"] == "buy":
            counts[row["class"]] = counts.get(row["class"], 0) + len(row["asset_ids"])
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
