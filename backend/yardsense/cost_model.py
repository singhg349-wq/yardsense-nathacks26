"""Pure cost functions: price the four options for one equipment request.

Every option has two numbers:
  project_cost = what the project is charged
  group_cost   = money that actually leaves the Northgate Group
"""
import math
from datetime import date, timedelta

MONTH_DAYS = 28
WEEK_DAYS = 7
HORIZON_DAYS = 365
HORIZON_MONTHS = 12


def road_km(lat1, lon1, lat2, lon2, road_factor):
    """Fallback: straight-line (haversine) distance in km, times a road factor."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a)) * road_factor


def move_km(unit, request, settings, road_distances):
    """Directed OSRM distance for unchanged seed sites, or straight-line fallback."""
    origin_id = unit.get("site_id")
    dest_id = request.get("site_id")
    if origin_id and origin_id == dest_id:
        return 0.0
    matrix = road_distances or {}
    coordinates = matrix.get("coordinates", {})
    if (coordinates.get(origin_id) == [unit["lat"], unit["lon"]]
            and coordinates.get(dest_id) == list(request["dest"])):
        km = matrix.get("distances_km", {}).get(origin_id, {}).get(dest_id)
        if km is not None and math.isfinite(km) and km >= 0:
            return km
    return road_km(unit["lat"], unit["lon"], *request["dest"], settings["road_factor"])


def transport_cost(km, s):
    """One truck move: base fee plus cost per km."""
    return 0.0 if km == 0 else s["truck_base_fee"] + km * s["truck_cost_per_km"]


def rental_price(days, card):
    """Cheapest way to cover `days` with months (28 d), weeks (7 d) and days.

    Covering more days than needed is allowed, so a partial tier never
    costs more than the next tier up.
    """
    if days <= 0:
        return 0.0
    best = [0.0] * (days + 1)
    for d in range(1, days + 1):
        best[d] = min(
            best[max(0, d - MONTH_DAYS)] + card["month"],
            best[max(0, d - WEEK_DAYS)] + card["week"],
            best[d - 1] + card["day"],
        )
    return best[days]


def days_between(start, finish):
    """Inclusive number of days from start to finish."""
    return (finish - start).days + 1


def _clip_days(start, finish, lo, hi):
    """Days of [start, finish] that fall inside [lo, hi]."""
    a, b = max(start, lo), min(finish, hi)
    return max(0, (b - a).days + 1)


def _option(name, available, project, group, reason, breakdown, **extra):
    opt = {"option": name, "available": available,
           "project_cost": round(project, 2), "group_cost": round(group, 2),
           "kept_in_group": 0.0, "reason": reason,
           "breakdown": [{"label": l, "amount": round(a, 2)} for l, a in breakdown]}
    opt.update(extra)
    return opt


def _unavailable(name, reason):
    return _option(name, False, 0, 0, reason, [])


def _move_option(name, units, request, cls, s, days, who, road_distances):
    """Shared math for move_ours and rent_sister (an idle unit is trucked over)."""
    qty = request["qty"]
    label = cls["label"]
    if len(units) < qty:
        return _unavailable(name, f"Only {len(units)} idle {label} unit(s) {who}; need {qty}.")
    chosen = []
    for u in units:
        km = move_km(u, request, s, road_distances)
        chosen.append((km, u))
    chosen.sort(key=lambda t: t[0])
    chosen = chosen[:qty]
    trucking = sum(transport_cost(km, s) for km, _ in chosen)
    rent = qty * rental_price(days, cls["internal"])
    wear = qty * cls["wear_per_day"] * days
    first_km, first = chosen[0]
    first_truck = transport_cost(first_km, s)
    reason = (f"{label} idle {first['where']}; {first_km:.0f} km, ${first_truck:,.0f} truck."
              if first_km else f"{label} idle {first['where']}; already on site, no truck move.")
    if qty > 1:
        reason = f"{qty} x {label} idle {who}; nearest {first_km:.0f} km, ${trucking:,.0f} total truck."
    return _option(
        name, True, rent + trucking, trucking + wear, reason,
        [("Internal rental", rent), ("Transport", trucking)],
        asset_ids=[unit["asset_id"] for _, unit in chosen],
        moves=[{"asset_id": unit["asset_id"], "from_site_id": unit["site_id"],
                "to_site_id": request["site_id"], "km": round(km, 1),
                "transport_cost": round(transport_cost(km, s), 2)}
               for km, unit in chosen],
        group_breakdown=[{"label": "Transport", "amount": round(trucking, 2)},
                         {"label": "Wear", "amount": round(wear, 2)}])


# ---- Owning one extra unit: shared by the per-request buy test and the fleet advisor.

def _runs(active, level):
    """Lengths of consecutive day runs where demand reaches `level` units."""
    runs, current = [], 0
    for quantity in list(active) + [0]:
        if quantity >= level:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    return runs


def demand_by_day(spans, today, days=HORIZON_DAYS):
    """Concurrent units needed on each day of the horizon; spans repeat per unit of qty."""
    active = [0] * days
    for start, finish in spans:
        first = max(0, (start - today).days)
        last = min(days - 1, (finish - today).days)
        for index in range(first, last + 1):
            active[index] += 1
    return active


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
    """Money case for the k-th unit added on top of `supply`.

    The unit only works on days when more than supply + k - 1 units are needed
    at once; rent avoided is outside rental plus delivery for each run of them.
    """
    runs = _runs(active, supply + k)
    rent = sum(rental_price(days, rates["outside"]) + rates["outside_delivery_fee"]
               for days in runs)
    own = cost_to_own(rates)
    net = round(rent - own, 2)
    return {"unit": k, "days": sum(runs), "rentals": len(runs),
            "rent_avoided": round(rent, 2), "cost_to_own": round(own, 2),
            "net_annual_impact": net, "breakeven_month": breakeven_months(rates, net)}


def owning_share(request_days, unit_days):
    """Fraction of one unit's yearly cost to own carried by a need using it.

    share = the need's days in the 12-month horizon / the unit's planned days
    there, capped at 1. A unit with no other planned days is fully charged.
    """
    if unit_days <= 0:
        return 1.0
    return min(1.0, request_days / unit_days)


def _buy_option(request, cls, s, days, pipeline, idle_exists, supply):
    """Northgate Rentals buys the unit(s), judged on each unit's own marginal demand.

    Available only when every extra unit nets a positive annual impact over the
    next 12 months (the fleet advisor's test). The group cost is this need's
    share of each unit's yearly cost to own (its days / the unit's planned days);
    the rest is carried by the later needs that unit covers.
    """
    label = cls["label"]
    if idle_exists:
        return _unavailable("buy", f"The group already has idle {label} units; no need to buy.")
    today = s["today"]
    qty = request["qty"]
    active = demand_by_day(pipeline, today)
    units = [marginal_unit(cls, active, supply, k) for k in range(1, qty + 1)]
    own = cost_to_own(cls)
    horizon_end = today + timedelta(days=HORIZON_DAYS - 1)
    request_days = _clip_days(request["start"], request["finish"], today, horizon_end)
    shares = [owning_share(request_days, unit["days"]) for unit in units]
    group = sum(share * own for share in shares)
    remainder = qty * own - group
    internal = qty * rental_price(days, cls["internal"])
    last = units[-1]
    net = round(sum(unit["net_annual_impact"] for unit in units), 2)
    sign = "-" if last["net_annual_impact"] < 0 else ""
    which = f"one more {label}" if qty == 1 else f"the last of {qty} extra {label} units"
    case = (f"{which} would cover {last['days']} days in 12 months, avoiding "
            f"${last['rent_avoided']:,.0f} of outside rent against ${own:,.0f} a year to own "
            f"(nets {sign}${abs(last['net_annual_impact']):,.0f}/yr)")
    if last["net_annual_impact"] <= 0:
        ok, breakeven = False, None
        reason = f"Does not pay: {case}."
    else:
        ok = True
        breakeven = breakeven_months(cls, net / qty)
        reason = f"Buy: {case}; pays back in month {breakeven}."
    planned = " + ".join(str(unit["days"]) for unit in units)
    breakdown = [("Internal rental from Northgate Rentals", internal)]
    return _option("buy", ok, internal, group, reason, breakdown, breakeven_month=breakeven,
                   net_annual_impact=net, marginal_units=units,
                   owning_cost=round(qty * own, 2), owning_remainder=round(remainder, 2),
                   owning_shares=[round(share * own, 2) for share in shares],
                   group_breakdown=[
                       {"label": (f"This need's share of {qty} x ${own:,.0f}/yr to own "
                                  f"({request_days} of {planned} planned unit-days)"),
                        "amount": round(group, 2)},
                       {"label": "Not in this cost: carried by later needs the unit covers",
                        "amount": round(remainder, 2)}])


def price_options(request, cls_rates, settings, idle_owned, idle_sister, pipeline,
                  road_distances=None, supply=0):
    """Return the 4 options (move_ours, rent_sister, rent_outside, buy) for a request.

    request: {class, qty, start, finish (dates), site_id, dest: (lat, lon)}
    idle_owned / idle_sister: idle units as dicts {asset_id, site_id, lat, lon, where}
    pipeline: list of (start, finish) needs for this class across all projects
    supply: usable group units of this class (plus units the plan already bought);
            an extra unit only earns on days demand exceeds it
    """
    s = dict(settings)
    s["today"] = date.fromisoformat(settings["demo_today"])
    cls = cls_rates
    days = days_between(request["start"], request["finish"])
    qty = request["qty"]

    move = _move_option("move_ours", idle_owned, request, cls, s, days,
                        "owned by NB01/NE01", road_distances)
    sister = _move_option("rent_sister", idle_sister, request, cls, s, days,
                          "at Northgate Rentals", road_distances)

    out_rent = qty * rental_price(days, cls["outside"])
    out_fee = qty * cls["outside_delivery_fee"]
    outside = _option("rent_outside", True, out_rent + out_fee, out_rent + out_fee,
                      f"Outside rental for {days} days, delivery included.",
                      [("Outside rental", out_rent), ("Delivery", out_fee)])

    buy = _buy_option(request, cls, s, days, pipeline, bool(idle_owned or idle_sister),
                      supply)

    options = [move, sister, outside, buy]
    for o in options:
        if o["available"]:
            o["kept_in_group"] = round(outside["group_cost"] - o["group_cost"], 2) if o is not outside else 0.0
    return options


def rank(options):
    """Available options first, cheapest group cost first."""
    return sorted(options, key=lambda o: (not o["available"], o["group_cost"]))
