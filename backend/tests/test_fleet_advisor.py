"""Tests for the rule-based fleet advisor and GET /fleet-advisor."""
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


def items_by_class(response):
    return {item["class"]: item for item in response.json()["items"]}


def test_fleet_advisor_endpoint_shape(client):
    response = client.get("/fleet-advisor")
    assert response.status_code == 200
    data = response.json()
    assert data["rules"]
    assert len(data["items"]) == 8
    required = {"class", "label", "owned", "peak_units", "pipeline_days",
                "utilization_pct", "action", "quantity", "breakeven_month",
                "annual_impact", "reason"}
    for item in data["items"]:
        assert required <= set(item)
        assert item["action"] in {"add", "retire", "hold"}
        assert item["reason"]


def test_advisor_recommends_additions_where_peak_exceeds_fleet(client):
    items = items_by_class(client.get("/fleet-advisor"))
    adds = [item for item in items.values() if item["action"] == "add"]
    assert adds
    for item in adds:
        assert item["peak_units"] > item["owned"]
        assert item["quantity"] >= 1
        assert item["breakeven_month"] <= 6
        assert item["unmet_unit_days"] > 0
        assert item["annual_impact"] > 0


def test_advisor_retires_only_surplus_low_utilization_units(client):
    items = items_by_class(client.get("/fleet-advisor"))
    retires = [item for item in items.values() if item["action"] == "retire"]
    assert retires
    for item in retires:
        assert item["peak_units"] < item["owned"]
        assert item["utilization_pct"] < 20
        assert item["quantity"] == 1


def test_advisor_is_deterministic(client):
    first = client.get("/fleet-advisor").json()
    second = client.get("/fleet-advisor").json()
    assert first == second
