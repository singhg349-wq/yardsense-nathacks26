"""Tests for the synthetic 12-month backtest and GET /backtest."""
import json
import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import api, backtest  # noqa: E402
from yardsense.config import SEED_DIR as SEED  # noqa: E402


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def test_history_is_synthetic_and_complete():
    history = backtest.load_history()
    assert history["synthetic"] is True
    assert len(history["requests"]) >= 80
    required = {"id", "project_name", "site_id", "class", "qty", "start", "finish",
                "actual_option", "internal_available", "sister_available"}
    for request in history["requests"]:
        assert required <= set(request)
        assert request["actual_option"] in {"move_ours", "rent_sister", "rent_outside"}
        assert date.fromisoformat(request["start"]) <= date.fromisoformat(request["finish"])


def test_backtest_is_deterministic():
    world = api.load_world()
    assert backtest.run_backtest(world) == backtest.run_backtest(world)


def test_backtest_endpoint(client):
    response = client.get("/backtest")
    assert response.status_code == 200
    data = response.json()
    assert data["synthetic"] is True
    assert data["requests"] == len(backtest.load_history()["requests"])
    assert data["outside_spend_actual"] > 0
    assert data["outside_spend_avoided"] > 0
    assert 0 <= data["kept_pct"] <= 100
    assert data["leaks"] > 0
    assert data["by_class"] and data["assumptions"]
    assert data["top_leaks"] == sorted(data["top_leaks"], key=lambda row: -row["saved"])
    for row in data["top_leaks"]:
        assert row["actual"] == "rent_outside"
        assert row["recommended"] != "rent_outside"
        assert row["saved"] > 0


def test_replay_never_recommends_buy(client):
    data = client.get("/backtest").json()
    assert "buy" not in data["option_mix"]["recommended"]


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import generate_backtest_history as generator  # noqa: E402


def _mini_world():
    """A tiny hand-checkable world: one class, one site, a group and a rental yard."""
    sites = [
        {"id": "Y-G", "name": "Group yard", "kind": "yard", "company": "G1", "lat": 53.0, "lon": -113.0},
        {"id": "Y-R", "name": "Rental yard", "kind": "yard", "company": "R1", "lat": 53.1, "lon": -113.1},
        {"id": "S-A", "name": "Site A", "kind": "site", "company": "G1", "lat": 53.2, "lon": -113.2},
    ]
    return {
        "settings": {"demo_today": "2026-06-01", "horizon_months": 12, "max_breakeven_months": 6,
                     "road_factor": 1.3, "truck_cost_per_km": 2.0, "truck_base_fee": 100},
        "classes": {"LIFT": {
            "label": "Lift", "outside": {"day": 100, "week": 300, "month": 800},
            "outside_delivery_fee": 50, "internal": {"day": 80, "week": 250, "month": 700},
            "purchase_price": 20000, "resale_pct_per_year": 0.15, "maintenance_month": 100,
            "insurance_month": 20, "wear_per_day": 10}},
        "companies": [{"code": "G1", "name": "Group", "kind": "gc"},
                      {"code": "R1", "name": "Rentals", "kind": "rental"}],
        "sites": sites,
        "road_distances": {
            "coordinates": {site["id"]: [site["lat"], site["lon"]] for site in sites},
            "distances_km": {"Y-G": {"S-A": 10.0}, "Y-R": {"S-A": 10.0}},
        },
        "projects": [],
    }


def _request(rid, actual, internal, sister):
    return {"id": rid, "project_name": "Test", "site_id": "S-A", "class": "LIFT", "qty": 1,
            "start": "2026-01-01", "finish": "2026-01-28", "actual_option": actual,
            "internal_available": internal, "sister_available": sister}


def test_hand_worked_replay():
    world = _mini_world()
    history = {"period": {"start": "2026-01-01", "finish": "2026-12-31"}, "requests": [
        _request("R1", "rent_outside", True, False),   # leak
        _request("R2", "rent_outside", False, False),  # no idle unit: stays outside
        _request("R3", "rent_sister", True, False),    # group and sister tie: no change
    ]}
    result = backtest.run_backtest(world, history)
    rows = {row["id"]: backtest.replay_request(world, row) for row in history["requests"]}

    # Jan 1 to Jan 28 inclusive is 28 days: exactly one 4-week tier.
    assert rows["R1"]["days"] == 28
    # Outside: 4-week rate 800 + delivery 50.
    assert rows["R1"]["actual_cost"] == 850
    # Move ours from the group yard: truck 100 + 10 km x 2 = 120, wear 10 x 28 = 280.
    assert rows["R1"]["recommended"] == "move_ours"
    assert rows["R1"]["recommended_cost"] == 400
    assert rows["R1"]["saved"] == 450
    assert rows["R1"]["from_site_ids"] == ["Y-G"] and rows["R1"]["trucking"] == 120
    assert rows["R1"]["is_leak"] is True

    assert rows["R2"]["recommended"] == "rent_outside" and rows["R2"]["saved"] == 0
    assert rows["R2"]["is_leak"] is False

    # Sister unit from the rental yard costs the same 400 as moving ours: a tie.
    assert rows["R3"]["actual"] == "rent_sister" and rows["R3"]["actual_cost"] == 400
    assert rows["R3"]["recommended"] == "rent_sister" and rows["R3"]["changed"] is False

    assert result["outside_spend_actual"] == 1700
    assert result["outside_spend_avoided"] == 450
    assert result["kept_pct"] == 26.5
    assert result["leaks"] == 1
    assert result["changed_decisions"] == 1


def test_real_data_moves_units_from_yards_with_trucking():
    world = api.load_world()
    yards = {site["id"] for site in world["sites"] if site["kind"] == "yard"}
    moved = 0
    for request in backtest.load_history()["requests"]:
        row = backtest.replay_request(world, request)
        if row["recommended"] in {"move_ours", "rent_sister"}:
            moved += 1
            assert row["from_site_ids"] and set(row["from_site_ids"]) <= yards
            assert row["trucking"] > 0
        if row["changed"]:
            assert row["saved"] > 0
    assert moved > 0


def test_availability_is_independent_of_the_actual_decision():
    sites = json.loads((SEED / "sites.json").read_text())
    today = date(2026, 11, 16)
    base = generator.build_history(sites, today)
    all_outside = generator.build_history(sites, today, decision_weights=[("rent_outside", 1)])
    all_sister = generator.build_history(sites, today, decision_weights=[("rent_sister", 1)])

    def flags(history):
        return {row["id"]: (row["internal_available"], row["sister_available"])
                for row in history["requests"]}

    assert flags(base) == flags(all_outside) == flags(all_sister)
    rate = sum(any(f) for f in flags(base).values()) / len(base["requests"])
    assert 0.12 <= rate <= 0.28


def test_committed_history_matches_generator():
    sites = json.loads((SEED / "sites.json").read_text())
    rebuilt = generator.build_history(sites, date(2026, 11, 16))
    assert rebuilt == backtest.load_history()


def test_history_durations_land_on_rate_tiers():
    tiers = {d for d, _ in generator.DURATION_WEIGHTS}
    for request in backtest.load_history()["requests"]:
        days = (date.fromisoformat(request["finish"]) - date.fromisoformat(request["start"])).days + 1
        assert days in tiers


def test_headline_numbers_are_pinned():
    data = backtest.run_backtest(api.load_world())
    assert data["requests"] == 96
    assert data["outside_rentals"] == 55
    assert data["outside_spend_actual"] == 286266.0
    assert data["outside_spend_avoided"] == 48112.07
    assert data["kept_pct"] == 16.8
    assert data["leaks"] == 15
    assert data["changed_decisions"] == 16
