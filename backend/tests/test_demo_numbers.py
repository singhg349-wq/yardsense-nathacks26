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
    # No extra unit of any class nets a positive year after owning cost, so
    # nothing is bought and the live plan is no longer below the static model.
    assert data["engine_greedy"]["group_cost"] == cents(133928.34)
    assert data["engine_greedy"]["option_mix"] == {
        "move_ours": 3, "rent_sister": 3, "rent_outside": 10, "buy": 0}
    assert data["mincost"]["group_cost"] == cents(131168.69)
    assert data["greedy_static"]["group_cost"] == cents(133993.34)
    assert data["delta"] == {"group_cost": cents(2824.65), "pct": 2.1}
    assert data["engine_greedy"]["group_cost"] >= data["mincost"]["group_cost"]


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
    # One more generator covers 308 days: $10,050 of rent avoided against
    # $13,800 a year to own, so buying loses $3,750 and it is rented outside.
    assert top["GEN_45KW"]["option"] == "rent_outside"
    assert top["GEN_45KW"]["group_cost"] == cents(2590.00)
    generator = {item["class"]: item["options"] for item in
                 client.post("/recommend").json()["items"]}["GEN_45KW"]
    buy = next(option for option in generator if option["option"] == "buy")
    assert buy["available"] is False
    assert buy["breakeven_month"] is None
    assert buy["net_annual_impact"] == cents(-3750.00)


def test_kingsway_slip_flips_the_riverside_scissors_and_changes_two(client):
    plan = client.post("/plan", json=KINGSWAY_SLIP).json()
    assert len(plan["changed"]) == 2
    flips = {change["request_id"]: (change["from_option"], change["to_option"])
             for change in plan["changed"]}
    assert flips == {"PRJ-RIV:0": ("rent_sister", "rent_outside"),
                     "PRJ-CAP:2": ("rent_sister", "rent_outside")}
    # Kingsway's re-dated scissor phase now starts on Nov 16, before Riverside,
    # so it takes the two idle Northgate Rentals lifts first.
    kingsway = next(row for row in plan["allocations"] if row["request_id"] == "PRJ-KNG:2")
    assert kingsway["asset_ids"] == ["100003", "100004"]
    items = client.post("/recommend", json={
        "project_id": "PRJ-RIV", **KINGSWAY_SLIP,
        "items": [{"class": "SCISSOR_19", "qty": 2,
                   "start": "2026-11-23", "finish": "2027-01-31"}]}).json()["items"]
    assert items[0]["options"][0]["option"] == "rent_outside"
    assert items[0]["options"][0]["group_cost"] == cents(5198.00)


def test_whitemud_split_costs(client):
    rows = {row["class"]: row for row in client.get("/plan").json()["allocations"]
            if row["project_id"] == "PRJ-WMD"}
    assert rows["TELEHANDLER"]["option"] == "split"
    assert rows["TELEHANDLER"]["group_cost"] == cents(51964.16)
    assert rows["BOOM_60"]["option"] == "split"
    assert rows["BOOM_60"]["group_cost"] == cents(35529.07)
    for row in (rows["TELEHANDLER"], rows["BOOM_60"]):
        assert [(part["option"], part["qty"]) for part in row["units"]] == [
            ("move_ours", 1), ("rent_outside", 1)]
