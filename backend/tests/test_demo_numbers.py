"""Pins the exact numbers the pitch quotes.

If one of these fails, the demo story changed. Update the pitch and this file
together, on purpose; never just bump the number to make the test pass.
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


def test_live_plan_versus_min_cost(client):
    data = client.get("/mincost").json()
    assert data["requests"] == 16
    assert data["engine_greedy"]["group_cost"] == cents(56762.20)
    assert data["engine_greedy"]["option_mix"] == {
        "move_ours": 3, "rent_sister": 4, "rent_outside": 0, "buy": 9}
    assert data["mincost"]["group_cost"] == cents(123645.83)
    assert data["greedy_static"]["group_cost"] == cents(126470.48)
    assert data["delta"] == {"group_cost": cents(2824.65), "pct": 2.2}


def test_riverside_recommendations(client):
    top = {item["class"]: item["options"][0] for item in client.post("/recommend").json()["items"]}
    assert top["SCISSOR_19"]["option"] == "rent_sister"
    assert top["SCISSOR_19"]["group_cost"] == cents(2368.51)
    assert top["SCISSOR_19"]["project_cost"] == cents(4676.51)
    assert top["TELEHANDLER"]["option"] == "move_ours"
    assert top["TELEHANDLER"]["group_cost"] == cents(2997.74)
    assert top["TELEHANDLER"]["kept_in_group"] == cents(12422.26)
    move = top["TELEHANDLER"]["moves"][0]
    assert (move["from_site_id"], move["to_site_id"]) == ("S-WGT", "S-RIV")
    assert move["km"] == 10.6
    assert move["transport_cost"] == cents(197.74)
    assert top["GEN_45KW"]["option"] == "buy"
    assert top["GEN_45KW"]["group_cost"] == cents(2029.41)
    assert top["GEN_45KW"]["breakeven_month"] == 5


def test_kingsway_slip_flips_the_generator_and_changes_five(client):
    plan = client.post("/plan", json=KINGSWAY_SLIP).json()
    assert len(plan["changed"]) == 5
    flip = next(change for change in plan["changed"] if change["request_id"] == "PRJ-RIV:2")
    assert (flip["from_option"], flip["to_option"]) == ("buy", "rent_outside")
    items = client.post("/recommend", json={
        "project_id": "PRJ-RIV", **KINGSWAY_SLIP,
        "items": [{"class": "GEN_45KW", "qty": 1,
                   "start": "2026-11-23", "finish": "2027-01-31"}]}).json()["items"]
    assert items[0]["options"][0]["option"] == "rent_outside"
    assert items[0]["options"][0]["group_cost"] == cents(2590.00)


def test_whitemud_split_costs(client):
    rows = {row["class"]: row for row in client.get("/plan").json()["allocations"]
            if row["project_id"] == "PRJ-WMD"}
    assert rows["TELEHANDLER"]["option"] == "split"
    assert rows["TELEHANDLER"]["group_cost"] == cents(19264.42)
    assert rows["BOOM_60"]["option"] == "split"
    assert rows["BOOM_60"]["group_cost"] == cents(12580.59)
