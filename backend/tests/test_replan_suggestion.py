"""Tests for the suggestion-only re-plan of open requests."""
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import api, replan_suggestion  # noqa: E402

KINGSWAY_SLIP = {"shifts": [{"project_id": "PRJ-KNG", "days": 42}]}


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def test_replan_shape_and_arithmetic(client):
    response = client.get("/replan")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Optimal"
    for key in ("greedy_cost", "replan_cost", "switching_cost", "net_saving",
                "locked_count", "changes", "recommend", "assumptions"):
        assert key in data
    assert data["net_saving"] == pytest.approx(
        data["greedy_cost"] - data["replan_cost"] - data["switching_cost"], abs=0.01)
    assert data["recommend"] == (data["net_saving"] > 0)
    assert data["switching_cost"] == pytest.approx(
        sum(change["switching_cost"] for change in data["changes"]), abs=0.01)


def test_replan_matches_mincost_baselines(client):
    replan = client.get("/replan").json()
    compare = client.get("/mincost").json()
    assert replan["greedy_cost"] == compare["greedy_static"]["group_cost"]
    assert replan["replan_cost"] <= replan["greedy_cost"] + 0.01


def test_replan_seed_suggests_a_net_saving(client):
    data = client.get("/replan").json()
    assert data["recommend"] is True
    assert data["changes"]
    for change in data["changes"]:
        assert {"project", "class", "from_option", "to_option", "saving"} <= set(change)
        assert change["switching_cost"] > 0
        assert change["start"] > data["as_of"]


def test_replan_post_without_shifts_matches_get(client):
    assert client.post("/replan", json={"shifts": []}).json()["net_saving"] == \
        client.get("/replan").json()["net_saving"]


def test_replan_under_kingsway_slip(client):
    response = client.post("/replan", json=KINGSWAY_SLIP)
    assert response.status_code == 200
    data = response.json()
    assert data["net_saving"] <= data["greedy_cost"]
    assert data["recommend"] == (data["net_saving"] > 0)


def test_replan_unknown_project_is_404(client):
    response = client.post("/replan", json={"shifts": [{"project_id": "NOPE", "days": 3}]})
    assert response.status_code == 404


def test_replan_does_not_change_the_live_plan(client):
    before = client.get("/plan").json()
    client.post("/replan", json=KINGSWAY_SLIP)
    assert client.get("/plan").json() == before


def test_locked_requests_are_pinned_to_greedy(client):
    # A request starting on the demo date is locked and must never be listed.
    world = api.load_world()
    today = world["settings"]["demo_today"]
    world["projects"][0]["planned_equipment"].append(
        {"class": "SCISSOR_19", "qty": 1, "start": today, "finish": "2027-03-01",
         "phase": None})
    data = replan_suggestion.suggest(world)
    assert all(change["start"] > today for change in data["changes"])


def test_switch_fee_is_a_single_documented_constant():
    assert replan_suggestion.SWITCH_FEE == 150.0
    assert any("assumed" in line for line in replan_suggestion.ASSUMPTIONS)
