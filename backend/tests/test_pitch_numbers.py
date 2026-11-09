"""Pins the rest of the numbers the pitch says aloud.

test_demo_numbers.py pins the live plan, the static comparison and the Riverside
and Kingsway story. This file adds the Dashboard backtest, the fleet advisor's
calls and the Kingsway what-if totals, so a rate-card or seed-data change fails
here instead of on stage. If one fails, update the pitch and this file together,
on purpose; never just bump the number to make the test pass.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

KINGSWAY_SLIP = {"shifts": [{"project_id": "PRJ-KNG", "days": 42}]}


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def cents(value):
    return pytest.approx(value, abs=0.01)


def test_backtest_headline_over_the_api(client):
    data = client.get("/backtest").json()
    assert data["synthetic"] is True
    assert data["requests"] == 96
    assert data["outside_spend_avoided"] == cents(48112.07)
    assert data["outside_spend_actual"] == cents(286266.00)
    assert data["kept_pct"] == 16.8
    assert data["leaks"] == 15
    assert data["changed_decisions"] == 16
    # The availability rate is an input, and the Dashboard must say so.
    assert any("1 in 5" in line and "independently" in line for line in data["assumptions"])
    assert any("Buy is excluded" in line for line in data["assumptions"])


def test_backtest_biggest_leaks_are_telehandlers(client):
    data = client.get("/backtest").json()
    assert [(leak["request_id"], leak["class"], leak["saved"])
            for leak in data["top_leaks"][:2]] == [
        ("BT-0094", "TELEHANDLER", cents(13561.14)),
        ("BT-0096", "TELEHANDLER", cents(9018.39)),
    ]


def test_fleet_advisor_retires_one_mini_excavator_and_adds_nothing(client):
    data = client.get("/fleet-advisor").json()
    items = {item["class"]: item for item in data["items"]}
    assert data["total_annual_impact"] == 7200.0
    assert {key: (item["action"], item["quantity"]) for key, item in items.items()} == {
        "MINI_EX": ("retire", 1), "BOOM_60": ("hold", 0), "COMPACTOR_PLATE": ("hold", 0),
        "GEN_45KW": ("hold", 0), "HEATER_400K": ("hold", 0), "LIGHT_TOWER": ("hold", 0),
        "SCISSOR_19": ("hold", 0), "TELEHANDLER": ("hold", 0)}
    assert items["MINI_EX"]["retire_asset_ids"] == ["100050"]
    assert items["MINI_EX"]["annual_impact"] == 7200.0
    assert all(item["plan_purchases"] == 0 for item in items.values())


def test_fleet_advisor_prices_the_next_unit_of_each_overflow_class(client):
    items = {item["class"]: item["next_unit"]
             for item in client.get("/fleet-advisor").json()["items"]}
    # (days covered, rent avoided, cost to own for a year, net) for one more unit.
    expected = {
        "GEN_45KW": (308, 10050, 13800, -3750),
        "HEATER_400K": (96, 2970, 4470, -1500),
        "SCISSOR_19": (75, 2875, 6060, -3185),
        "TELEHANDLER": (54, 11500, 31800, -20300),
    }
    for cls, (days, avoided, owning, net) in expected.items():
        unit = items[cls]
        assert (unit["days"], unit["rent_avoided"], unit["cost_to_own"],
                unit["net_annual_impact"]) == (days, avoided, owning, net)
        assert unit["breakeven_month"] is None


def test_kingsway_slip_totals(client):
    baseline = client.get("/plan").json()["totals"]
    slipped = client.post("/plan", json=KINGSWAY_SLIP).json()["totals"]
    assert baseline == {"group_cost": cents(133928.34), "kept_in_group": cents(74702.66)}
    assert slipped == {"group_cost": cents(173545.13), "kept_in_group": cents(74359.87)}


def test_replan_suggestion_numbers(client):
    data = client.get("/replan").json()
    assert data["requests"] == 16
    assert data["greedy_cost"] == cents(133993.34)
    assert data["replan_cost"] == cents(131168.69)
    assert data["switching_cost"] == cents(354.26)
    assert data["net_saving"] == cents(2470.39)
    assert data["recommend"] is True


def test_riverside_outside_vs_recommended_totals(client):
    """The deck's headline: three Riverside needs, booked outside vs the engine's plan."""
    window = {"start": "2026-11-23", "finish": "2027-01-31"}
    items = [{"class": "SCISSOR_19", "qty": 2, **window},
             {"class": "TELEHANDLER", "qty": 1, **window},
             {"class": "GEN_45KW", "qty": 1, **window}]
    rows = client.post("/recommend", json={"project_id": "PRJ-RIV", "items": items}).json()["items"]
    picks = [next(o for o in row["options"] if o["available"]) for row in rows]
    outside = [next(o for o in row["options"] if o["option"] == "rent_outside") for row in rows]

    assert sum(o["group_cost"] for o in outside) == cents(23208.00)
    assert sum(o["project_cost"] for o in picks) == cents(20770.25)
    assert sum(o["group_cost"] for o in picks) == cents(7956.25)
    assert sum(o["kept_in_group"] for o in picks) == cents(15251.75)
