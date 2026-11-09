"""Tests for the rule-based fleet advisor and GET /fleet-advisor."""
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import allocator, api, fleet_advisor  # noqa: E402

TODAY = "2027-01-04"  # A Monday; every date below is counted from it.

# Outside rental 1,000 per 28-day month; owning costs 10,000 x 10% + 12 x 100 = 2,200 a year.
RATES = {
    "label": "Test unit",
    "outside": {"day": 100, "week": 400, "month": 1000},
    "outside_delivery_fee": 50,
    "internal": {"day": 90, "week": 360, "month": 900},
    "purchase_price": 10000,
    "resale_pct_per_year": 0.10,
    "maintenance_month": 60,
    "insurance_month": 40,
    "wear_per_day": 1,
}


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def items_by_class(result):
    return {item["class"]: item for item in result["items"]}


def small_world(needs, assets, assignments=()):
    """One class, one yard, one project site."""
    return {
        "settings": {"demo_today": TODAY, "horizon_months": 12, "max_breakeven_months": 6,
                     "road_factor": 1.3, "truck_cost_per_km": 4.5, "truck_base_fee": 150},
        "classes": {"TEST": RATES},
        "companies": [{"code": "NR01", "name": "Northgate Rentals", "kind": "rental"},
                      {"code": "NB01", "name": "Northgate Builders", "kind": "gc"}],
        "sites": [{"id": "Y-NR", "name": "Rentals yard", "kind": "yard", "company": "NR01",
                   "lat": 53.5, "lon": -113.5},
                  {"id": "Y-NB", "name": "Builders yard", "kind": "yard", "company": "NB01",
                   "lat": 53.6, "lon": -113.4},
                  {"id": "S-A", "name": "Site A", "kind": "site", "company": "NB01",
                   "lat": 53.55, "lon": -113.45}],
        "assets": [{"asset_id": asset_id, "asset_class": "TEST", "company": company}
                   for asset_id, company in assets],
        "assignments": [{"id": index + 1, "asset_id": asset_id, "project_id": None,
                         "site_id": "S-A", "checked_out": "2026-10-01", "checked_in": None}
                        for index, asset_id in enumerate(assignments)],
        "projects": [{"id": "PRJ-A", "site_id": "S-A", "planned_equipment": [
            {"class": "TEST", "qty": qty, "start": start, "finish": finish}
            for qty, start, finish in needs]}],
    }


def test_fleet_advisor_endpoint_shape(client):
    response = client.get("/fleet-advisor")
    assert response.status_code == 200
    data = response.json()
    assert data["rules"]
    assert len(data["items"]) == 8
    required = {"class", "label", "owned", "supply", "on_outside_hire", "peak_units",
                "pipeline_days", "utilization_pct", "action", "quantity", "breakeven_month",
                "annual_impact", "next_unit", "plan_purchases", "reason"}
    for item in data["items"]:
        assert required <= set(item)
        assert item["action"] in {"add", "retire", "hold"}
        assert item["reason"]
    assert data["total_annual_impact"] == round(
        sum(item["annual_impact"] for item in data["items"]), 2)


def test_each_extra_unit_is_priced_on_its_own_marginal_demand():
    # One idle unit in supply. Demand: 1 unit all year, +1 for 168 days, +1 more for 28 days.
    #   Unit 1 covers 168 days: 6 months x 1,000 + 50 delivery = 6,050 rent avoided.
    #     Net 6,050 - 2,200 = 3,850/yr; break-even 10,000 / (3,850 / 12) = 31.2 -> 32 months.
    #   Unit 2 covers 28 days: 1,000 + 50 = 1,050, net -1,150/yr, so it is not added.
    world = small_world(
        needs=[(1, "2027-01-04", "2027-12-05"),
               (1, "2027-01-04", "2027-06-20"),
               (1, "2027-01-04", "2027-01-31")],
        assets=[("T1", "NR01")])
    item = items_by_class(fleet_advisor.advise(world, plan=[]))["TEST"]
    assert item["peak_units"] == 3 and item["supply"] == 1
    first, second = item["marginal_units"]
    assert (first["days"], first["rent_avoided"], first["net_annual_impact"]) == (168, 6050, 3850)
    assert first["breakeven_month"] == 32
    assert (second["days"], second["rent_avoided"], second["net_annual_impact"]) == (28, 1050, -1150)
    assert second["breakeven_month"] is None
    assert item["action"] == "add" and item["quantity"] == 1
    assert item["annual_impact"] == 3850
    assert item["breakeven_month"] == 32


def test_a_unit_that_loses_money_is_not_added():
    # Two concurrent 28-day needs against one unit: the extra unit saves 1,050 but costs 2,200.
    world = small_world(needs=[(2, "2027-01-04", "2027-01-31")], assets=[("T1", "NR01")])
    item = items_by_class(fleet_advisor.advise(world, plan=[]))["TEST"]
    assert item["next_unit"]["net_annual_impact"] == -1150
    assert item["action"] == "hold"
    assert item["annual_impact"] == 0
    assert item["breakeven_month"] is None


def test_retire_skips_units_on_open_ended_outside_hire():
    # Three units, peak 1. Two are on outside hire, so the last one is needed: hold.
    world = small_world(needs=[(1, "2027-02-01", "2027-03-01")],
                        assets=[("T1", "NR01"), ("T2", "NR01"), ("T3", "NR01")],
                        assignments=["T1", "T2"])
    item = items_by_class(fleet_advisor.advise(world, plan=[]))["TEST"]
    assert item["supply"] == 1 and item["on_outside_hire"] == 2
    assert item["action"] == "hold"


def test_retire_names_an_idle_surplus_unit_from_any_group_company():
    # Three units, peak 1, one on outside hire: one of the two idle units is surplus.
    world = small_world(needs=[(1, "2027-02-01", "2027-03-01")],
                        assets=[("T1", "NR01"), ("T2", "NB01"), ("T3", "NR01")],
                        assignments=["T1"])
    item = items_by_class(fleet_advisor.advise(world, plan=[]))["TEST"]
    assert item["action"] == "retire" and item["quantity"] == 1
    assert item["retire_asset_ids"] == ["T3"]
    assert item["annual_impact"] == 12 * (60 + 40)


def test_seed_retires_only_idle_units_and_never_an_on_hire_class(client):
    items = items_by_class(client.get("/fleet-advisor").json())
    # Every Northgate Rentals compactor is on open-ended outside hire.
    assert items["COMPACTOR_PLATE"]["action"] == "hold"
    hired_out = {row["asset_id"] for row in client.get("/assignments").json()
                 if row["project_id"] is None and row["checked_in"] is None}
    for item in items.values():
        if item["action"] == "retire":
            assert item["supply"] - item["quantity"] >= item["peak_units"]
            assert not set(item["retire_asset_ids"]) & hired_out


def test_seed_adds_only_units_with_positive_net_impact(client):
    items = items_by_class(client.get("/fleet-advisor").json())
    for item in items.values():
        if item["action"] == "add":
            assert item["annual_impact"] > 0
            assert all(unit["net_annual_impact"] > 0
                       for unit in item["marginal_units"][:item["quantity"]])
        else:
            assert item["breakeven_month"] is None
    # Hand check: the 5th boom covers 26 days and saves 3,950 against 21,240 to own.
    boom = items["BOOM_60"]["next_unit"]
    assert (boom["days"], boom["rent_avoided"], boom["cost_to_own"]) == (26, 3950, 21240)
    assert items["BOOM_60"]["action"] == "hold"


def test_generator_call_explains_the_live_plan_purchase():
    world = api.load_world()
    plan = allocator.build_plan(world)
    bought = sum(len(row["asset_ids"]) for row in plan
                 if row["class"] == "GEN_45KW" and row["option"] == "buy")
    generator = items_by_class(fleet_advisor.advise(world, plan))["GEN_45KW"]
    assert generator["plan_purchases"] == bought
    # All five generators are on outside hire, so the group has none to serve the pipeline.
    assert generator["supply"] == 0 and generator["on_outside_hire"] == 5
    if bought and generator["action"] != "add":
        assert f"The live plan buys {bought}" in generator["reason"]
        assert "$" in generator["reason"]


def test_advisor_is_deterministic(client):
    first = client.get("/fleet-advisor").json()
    second = client.get("/fleet-advisor").json()
    assert first == second
