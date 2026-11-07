"""Tests for the cost model and POST /recommend, using the seed data."""
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import api, cost_model  # noqa: E402


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def slip_project(project_id, days):
    """Return a loader that pushes one project's dates later by `days`."""
    real_loader = api.load_world

    def loader():
        world = real_loader()
        for p in world["projects"]:
            if p["id"] != project_id:
                continue
            for key in ("start_date", "completion_date"):
                p[key] = (date.fromisoformat(p[key]) + timedelta(days=days)).isoformat()
            for need in p["planned_equipment"]:
                for key in ("start", "finish"):
                    need[key] = (date.fromisoformat(need[key]) + timedelta(days=days)).isoformat()
        return world

    return loader


def options_by_class(response):
    return {item["class"]: item["options"] for item in response.json()["items"]}


def test_telehandler_move_ours_first(client):
    options = options_by_class(client.post("/recommend"))["TELEHANDLER"]
    assert options[0]["option"] == "move_ours"
    assert "Westgate" in options[0]["reason"]
    assert options[0]["group_cost"] < options[0]["project_cost"]


def test_scissor_lift_rent_sister_first(client):
    options = options_by_class(client.post("/recommend"))["SCISSOR_19"]
    assert options[0]["option"] == "rent_sister"
    assert options[0]["kept_in_group"] > 0


def test_generator_buy_first_with_early_breakeven(client):
    options = options_by_class(client.post("/recommend"))["GEN_45KW"]
    assert options[0]["option"] == "buy"
    assert options[0]["breakeven_month"] <= 6


def test_generator_flips_to_rent_outside_when_project_slips(client, monkeypatch):
    monkeypatch.setattr(api, "load_world", slip_project("PRJ-KNG", 42))
    options = options_by_class(client.post("/recommend"))["GEN_45KW"]
    buy = next(o for o in options if o["option"] == "buy")
    assert not buy["available"]
    assert buy["breakeven_month"] is None or buy["breakeven_month"] > 6
    assert options[0]["option"] == "rent_outside"


def test_rental_price_tiers():
    card = {"day": 100, "week": 450, "month": 1300}
    assert cost_model.rental_price(0, card) == 0
    assert cost_model.rental_price(10, card) <= 2 * card["week"]
    assert cost_model.rental_price(6, card) <= card["week"]
    assert cost_model.rental_price(25, card) <= card["month"]
    assert cost_model.rental_price(1, card) == card["day"]


def test_recommend_returns_four_options_per_item(client):
    response = client.post("/recommend")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 3
    for item in items:
        assert sorted(o["option"] for o in item["options"]) == [
            "buy", "move_ours", "rent_outside", "rent_sister"]
        for o in item["options"]:
            assert {"project_cost", "group_cost", "kept_in_group", "reason", "breakdown"} <= set(o)


def test_recommend_accepts_a_body(client):
    body = {"project_id": "PRJ-RIV",
            "items": [{"class": "BOOM_60", "qty": 1, "start": "2026-12-01", "finish": "2026-12-31"}]}
    response = client.post("/recommend", json=body)
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1


def test_request_form_endpoints_validate_inputs(client):
    classes = client.get("/classes")
    assert classes.status_code == 200
    assert any(item["code"] == "GEN_45KW" for item in classes.json())

    body = {"project_id": "PRJ-RIV", "items": [
        {"class": "SCISSOR_19", "qty": 0,
         "start": "2026-11-23", "finish": "2027-01-31"}]}
    assert client.post("/recommend", json=body).status_code == 422
    body["items"][0]["qty"] = 1
    body["items"][0]["finish"] = "2026-11-22"
    assert client.post("/recommend", json=body).status_code == 422
    body["items"][0]["finish"] = "2027-01-31"
    body["project_id"] = "missing"
    assert client.post("/recommend", json=body).status_code == 404


def test_recommend_reflects_a_schedule_shift(client):
    body = {"project_id": "PRJ-RIV", "items": [
        {"class": "GEN_45KW", "qty": 1,
         "start": "2026-11-23", "finish": "2027-01-31"}],
            "shifts": [{"project_id": "PRJ-KNG", "days": 42}]}
    response = client.post("/recommend", json=body)
    assert response.status_code == 200
    assert response.json()["items"][0]["options"][0]["option"] == "rent_outside"
