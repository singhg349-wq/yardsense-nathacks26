#!/usr/bin/env python3
"""Generate deterministic synthetic backtest history for the YardSense demo.

Writes data/seed/backtest_history.json. Every value is synthetic; no real
company names or real numbers are used. Run from the repo root:

    python backend/scripts/generate_backtest_history.py
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
REQUEST_COUNT = 96

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

DURATION_WEIGHTS = [(14, 10), (21, 15), (28, 25), (42, 20), (56, 12), (70, 10), (84, 8)]
DECISION_WEIGHTS = [("rent_outside", 62), ("rent_sister", 22), ("move_ours", 16)]


def weighted_choice(rng, pairs):
    """Pick one value from [(value, weight), ...]."""
    values, weights = zip(*pairs)
    return rng.choices(values, weights=weights, k=1)[0]


def main():
    rng = random.Random(SEED)
    settings = load_rates()["settings"]
    demo_today = date.fromisoformat(settings["demo_today"])
    period_end = demo_today - timedelta(days=1)
    period_start = period_end - timedelta(days=364)

    with open(SEED_DIR / "sites.json") as handle:
        sites = json.load(handle)
    site_ids = [site["id"] for site in sites]

    projects = [(name, weight) for name, weight in zip(PAST_PROJECTS, [1] * len(PAST_PROJECTS))]
    classes = list(CLASS_WEIGHTS)
    class_pairs = [(name, CLASS_WEIGHTS[name]) for name in classes]

    requests = []
    for index in range(1, REQUEST_COUNT + 1):
        duration = weighted_choice(rng, DURATION_WEIGHTS)
        latest_start = period_end - timedelta(days=duration)
        span = (latest_start - period_start).days
        start = period_start + timedelta(days=rng.randint(0, max(0, span)))
        finish = start + timedelta(days=duration)

        actual_option = weighted_choice(rng, DECISION_WEIGHTS)
        internal_available = actual_option == "move_ours" or rng.random() < 0.32
        sister_available = actual_option == "rent_sister" or rng.random() < 0.30

        requests.append({
            "id": f"BT-{index:04d}",
            "project_name": weighted_choice(rng, projects),
            "site_id": rng.choice(site_ids),
            "class": weighted_choice(rng, class_pairs),
            "qty": rng.choices([1, 2, 3], weights=[70, 25, 5], k=1)[0],
            "start": start.isoformat(),
            "finish": finish.isoformat(),
            "actual_option": actual_option,
            "internal_available": internal_available,
            "sister_available": sister_available,
        })

    requests.sort(key=lambda row: (row["start"], row["id"]))
    payload = {
        "synthetic": True,
        "generated_on": demo_today.isoformat(),
        "method": "Deterministic generator (seed 42); 12 months ending the day before demo_today.",
        "period": {"start": period_start.isoformat(), "finish": period_end.isoformat()},
        "requests": requests,
    }
    path = SEED_DIR / "backtest_history.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(requests)} synthetic requests to {path}")


if __name__ == "__main__":
    main()
