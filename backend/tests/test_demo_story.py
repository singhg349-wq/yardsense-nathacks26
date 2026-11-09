"""Demo-story gate: the recommendations the pitch depends on.

These tests run before and after any rate-card change. If a sourced rate
breaks the story, change project dates or quantities, never the sourced rate.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import api  # noqa: E402


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def top_options(response):
    return {item["class"]: item["options"][0] for item in response.json()["items"]}


def slip_project(project_id, days):
    real_loader = api.load_world

    def loader():
        world = real_loader()
        for project in world["projects"]:
            if project["id"] != project_id:
                continue
            for key in ("start_date", "completion_date"):
                project[key] = (date.fromisoformat(project[key]) + timedelta(days=days)).isoformat()
            for need in project["planned_equipment"]:
                for key in ("start", "finish"):
                    need[key] = (date.fromisoformat(need[key]) + timedelta(days=days)).isoformat()
        return world

    return loader


def test_telehandler_moves_from_westgate(client):
    top = top_options(client.post("/recommend"))
    assert top["TELEHANDLER"]["option"] == "move_ours"
    assert "Westgate" in top["TELEHANDLER"]["reason"]


def test_scissor_lifts_come_from_the_sister_yard(client):
    top = top_options(client.post("/recommend"))
    assert top["SCISSOR_19"]["option"] == "rent_sister"


def test_generator_is_rented_because_buying_one_loses_money(client):
    options = {item["class"]: item["options"] for item in client.post("/recommend").json()["items"]}
    assert options["GEN_45KW"][0]["option"] == "rent_outside"
    buy = next(option for option in options["GEN_45KW"] if option["option"] == "buy")
    assert buy["available"] is False
    assert buy["net_annual_impact"] < 0


def test_scissors_flip_to_outside_when_kingsway_slips(client, monkeypatch):
    monkeypatch.setattr(api, "load_world", slip_project("PRJ-KNG", 42))
    options = {item["class"]: item["options"] for item in client.post("/recommend").json()["items"]}
    assert options["SCISSOR_19"][0]["option"] == "rent_outside"
    assert options["GEN_45KW"][0]["option"] == "rent_outside"
