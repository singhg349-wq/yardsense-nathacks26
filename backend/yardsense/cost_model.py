"""Pure cost functions: price the four options for one equipment request.

Every option has two numbers:
  project_cost = what the project is charged
  group_cost   = money that actually leaves the Northgate Group
"""
import math
from datetime import date, timedelta

MONTH_DAYS = 28
WEEK_DAYS = 7


def road_km(lat1, lon1, lat2, lon2, road_factor):
    """Straight-line (haversine) distance in km, times a road factor."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a)) * road_factor


def transport_cost(km, s):
    """One truck move: base fee plus cost per km."""
    return s["truck_base_fee"] + km * s["truck_cost_per_km"]


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


def _move_option(name, units, request, cls, s, days, who):
    """Shared math for move_ours and rent_sister (an idle unit is trucked over)."""
    qty = request["qty"]
    label = cls["label"]
    if len(units) < qty:
        return _unavailable(name, f"Only {len(units)} idle {label} unit(s) {who}; need {qty}.")
    dest = request["dest"]
    chosen = []
    for u in units:
        km = road_km(u["lat"], u["lon"], dest[0], dest[1], s["road_factor"])
        chosen.append((km, u))
    chosen.sort(key=lambda t: t[0])
    chosen = chosen[:qty]
    trucking = sum(transport_cost(km, s) for km, _ in chosen)
    rent = qty * rental_price(days, cls["internal"])
    wear = qty * cls["wear_per_day"] * days
    first_km, first = chosen[0]
    reason = f"{label} idle {first['where']}; {first_km:.0f} km move."
    if qty > 1:
        reason = f"{qty} x {label} idle {who}; nearest is {first_km:.0f} km away."
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


def _buy_option(request, cls, s, days, pipeline, idle_exists):
    """Northgate Rentals buys one, then rents it to every pipeline project."""
    label = cls["label"]
    if idle_exists:
        return _unavailable("buy", f"The group already has idle {label} units; no need to buy.")
    today = s["today"]
    horizon = s["horizon_months"]
    outside = cls["outside"]
    fee = cls["outside_delivery_fee"]
    price = cls["purchase_price"]
    carry = cls["maintenance_month"] + cls["insurance_month"]

    def cost_to_own(m):
        resale = price * (1 - cls["resale_pct_per_year"]) ** (m / 12)
        return price - resale + carry * m

    def savings(m):
        """Outside rental avoided for pipeline days before the end of month m."""
        end = today + timedelta(days=30 * m)
        total = 0.0
        for start, finish in pipeline:
            d = _clip_days(start, finish, today, end)
            if d > 0:
                total += rental_price(d, outside) + fee
        return total

    breakeven = None
    for m in range(1, horizon + 1):
        if savings(m) >= cost_to_own(m):
            breakeven = m
            break

    end = today + timedelta(days=30 * horizon)
    pipeline_days = sum(_clip_days(a, b, today, end) for a, b in pipeline)
    request_days = days * request["qty"]
    share = min(1.0, request_days / pipeline_days) if pipeline_days else 1.0
    own = cost_to_own(horizon) * share
    internal = request["qty"] * rental_price(days, cls["internal"])
    breakdown = [("Purchase price minus resale + carrying cost, this request's share", own)]
    n_projects = len(pipeline)

    if breakeven is None:
        reason = f"Does not break even within {horizon} months ({n_projects} pipeline need(s))."
        ok = False
    elif breakeven > s["max_breakeven_months"]:
        reason = (f"Break-even is month {breakeven}, later than the {s['max_breakeven_months']}-month limit "
                  f"({n_projects} pipeline need(s)).")
        ok = False
    else:
        reason = f"{n_projects} pipeline need(s) for {label} in {horizon} months; breaks even in month {breakeven}."
        ok = True
    return _option("buy", ok, internal, own, reason, breakdown, breakeven_month=breakeven)


def price_options(request, cls_rates, settings, idle_owned, idle_sister, pipeline):
    """Return the 4 options (move_ours, rent_sister, rent_outside, buy) for a request.

    request: {class, qty, start, finish (dates), site_id, dest: (lat, lon)}
    idle_owned / idle_sister: idle units as dicts {asset_id, site_id, lat, lon, where}
    pipeline: list of (start, finish) needs for this class across all projects
    """
    s = dict(settings)
    s["today"] = date.fromisoformat(settings["demo_today"])
    cls = cls_rates
    days = days_between(request["start"], request["finish"])
    qty = request["qty"]

    move = _move_option("move_ours", idle_owned, request, cls, s, days, "owned by NB01/NE01")
    sister = _move_option("rent_sister", idle_sister, request, cls, s, days, "at Northgate Rentals")

    out_rent = qty * rental_price(days, cls["outside"])
    out_fee = qty * cls["outside_delivery_fee"]
    outside = _option("rent_outside", True, out_rent + out_fee, out_rent + out_fee,
                      f"Outside rental for {days} days, delivery included.",
                      [("Outside rental", out_rent), ("Delivery", out_fee)])

    buy = _buy_option(request, cls, s, days, pipeline, bool(idle_owned or idle_sister))

    options = [move, sister, outside, buy]
    for o in options:
        if o["available"]:
            o["kept_in_group"] = round(outside["group_cost"] - o["group_cost"], 2) if o is not outside else 0.0
    return options


def rank(options):
    """Available options first, cheapest group cost first."""
    return sorted(options, key=lambda o: (not o["available"], o["group_cost"]))
