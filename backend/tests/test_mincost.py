"""Tests for the PuLP static assignment comparison."""
import sys
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


def test_mincost_endpoint_shape(client):
    response = client.get("/mincost")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Optimal"
    assert data["requests"] > 0
    assert data["runtime_ms"] >= 0
    assert data["assumptions"]
    for key in ("greedy_static", "mincost", "engine_greedy"):
        assert {"group_cost", "option_mix", "requests"} <= set(data[key])
    assert data["mincost"]["requests"] == data["requests"]


def test_mincost_beats_or_matches_the_static_greedy(client):
    data = client.get("/mincost").json()
    assert data["mincost"]["group_cost"] <= data["greedy_static"]["group_cost"] + 0.01
    assert data["delta"]["group_cost"] >= -0.01
    assert data["delta"]["pct"] >= -0.1


def test_mincost_is_deterministic(client):
    first = client.get("/mincost").json()
    second = client.get("/mincost").json()
    for key in ("greedy_static", "mincost", "engine_greedy", "delta", "requests", "status"):
        assert first[key] == second[key]


def test_mincost_option_mix_covers_every_request(client):
    data = client.get("/mincost").json()
    assert sum(data["mincost"]["option_mix"].values()) == data["requests"]
    assert sum(data["greedy_static"]["option_mix"].values()) == data["requests"]
