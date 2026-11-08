"""Tests for the synthetic 12-month backtest and GET /backtest."""
import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import api, backtest  # noqa: E402


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
