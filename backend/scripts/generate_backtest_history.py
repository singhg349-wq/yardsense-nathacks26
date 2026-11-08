#!/usr/bin/env python3
"""Generate deterministic synthetic backtest history for the YardSense demo.

Writes data/seed/backtest_history.json. Every value is synthetic; no real
company names or real numbers are used. Run from the repo root:

    python backend/scripts/generate_backtest_history.py

Two independent random streams are used:
  * the request stream draws the project, site, class, quantity, dates and
    the decision the group actually made;
  * the availability stream draws whether a comparable idle group or sister
    unit existed. It never sees the decision, so the share of outside rentals
    that had a free unit is the stated base rate, not a function of what the
    group did.
"""
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from yardsense.config import SEED_DIR, load_rates  # noqa: E402

SEED = 42
AVAILABILITY_SEED = 4242
REQUEST_COUNT = 96

# Assumption: about 1 in 5 outside rentals had a comparable idle group or
# sister unit, based on industry interviews and published fleet-utilization
# figures. The same rate applies to every request, whatever was decided.
IDLE_UNIT_RATE = 0.20
# When an idle unit existed, where it sat: group yard, sister yard, or both.
IDLE_SOURCE_WEIGHTS = [("group", 45), ("sister", 45), ("both", 10)]

PAST_PROJECTS = [
    "Aurora Waterworks",
    "Belmont Transit Yard",
    "Cedar Ridge School",
    "Dunmore Cold Storage",
    "Elmwood Pump Station",
    "Falcon Industrial Park",
    "Glenora Library",
    "Harbour Point Warehouse",
]

CLASS_WEIGHTS = {
    "SCISSOR_19": 22,
    "TELEHANDLER": 16,
    "GEN_45KW": 14,
    "BOOM_60": 10,
    "HEATER_400K": 10,
    "LIGHT_TOWER": 10,
    "COMPACTOR_PLATE": 10,
    "MINI_EX": 8,
}

# Rental lengths in inclusive days, matching the cost model's day count.
DURATION_WEIGHTS = [(14, 10), (21, 15), (28, 25), (42, 20), (56, 12), (70, 10), (84, 8)]
DECISION_WEIGHTS = [("rent_outside", 62), ("rent_sister", 22), ("move_ours", 16)]
GROUP_PROJECT_COMPANIES = {"NB01", "NE01"}


def weighted_choice(rng, pairs):
    """Pick one value from [(value, weight), ...]."""
    values, weights = zip(*pairs)
    return rng.choices(values, weights=weights, k=1)[0]


def draw_availability(rng, rate=IDLE_UNIT_RATE):
    """(internal_available, sister_available) for one request, from its own stream."""
    if rng.random() >= rate:
        return False, False
    source = weighted_choice(rng, IDLE_SOURCE_WEIGHTS)
    return source in ("group", "both"), source in ("sister", "both")


def build_history(sites, demo_today, seed=SEED, availability_seed=AVAILABILITY_SEED,
                  count=REQUEST_COUNT, decision_weights=DECISION_WEIGHTS,
                  idle_rate=IDLE_UNIT_RATE):
    """Return the synthetic history payload (pure; no file I/O)."""
    rng = random.Random(seed)
    avail_rng = random.Random(availability_seed)
    period_end = demo_today - timedelta(days=1)
    period_start = period_end - timedelta(days=364)

    site_ids = [site["id"] for site in sites
                if site["kind"] == "site" and site["company"] in GROUP_PROJECT_COMPANIES]
    class_pairs = list(CLASS_WEIGHTS.items())

    requests = []
    for index in range(1, count + 1):
        duration = weighted_choice(rng, DURATION_WEIGHTS)
        latest_start = period_end - timedelta(days=duration - 1)
        span = (latest_start - period_start).days
        start = period_start + timedelta(days=rng.randint(0, max(0, span)))
        finish = start + timedelta(days=duration - 1)  # inclusive: `duration` rental days
        actual_option = weighted_choice(rng, decision_weights)
        project_name = rng.choice(PAST_PROJECTS)
        site_id = rng.choice(site_ids)
        asset_class = weighted_choice(rng, class_pairs)
        qty = rng.choices([1, 2, 3], weights=[70, 25, 5], k=1)[0]

        internal_available, sister_available = draw_availability(avail_rng, idle_rate)

        requests.append({
            "id": f"BT-{index:04d}",
            "project_name": project_name,
            "site_id": site_id,
            "class": asset_class,
            "qty": qty,
            "start": start.isoformat(),
            "finish": finish.isoformat(),
            "actual_option": actual_option,
            "internal_available": internal_available,
            "sister_available": sister_available,
        })

    requests.sort(key=lambda row: (row["start"], row["id"]))
    return {
        "synthetic": True,
        "generated_on": demo_today.isoformat(),
        "method": (f"Deterministic generator (seeds {seed} and {availability_seed}); "
                   "12 months ending the day before demo_today. Availability flags come "
                   "from their own random stream, independent of the actual decision, "
                   f"at a {round(idle_rate * 100)}% base rate."),
        "period": {"start": period_start.isoformat(), "finish": period_end.isoformat()},
        "requests": requests,
    }


def main():
    settings = load_rates()["settings"]
    demo_today = date.fromisoformat(settings["demo_today"])
    with open(SEED_DIR / "sites.json") as handle:
        sites = json.load(handle)
    payload = build_history(sites, demo_today)
    path = SEED_DIR / "backtest_history.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['requests'])} synthetic requests to {path}")


if __name__ == "__main__":
    main()
