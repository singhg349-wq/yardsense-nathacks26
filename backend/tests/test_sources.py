"""Tests for the data provenance endpoint and file."""
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import api, sources  # noqa: E402


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def test_sources_file_has_the_core_sources():
    data = sources.load_sources()
    ids = {source["id"] for source in data["sources"]}
    assert {"sap", "procore", "rates", "backtest", "assignments"} <= ids
    assert data["synthetic_demo"] is True


def test_sources_endpoint_shape(client):
    response = client.get("/sources")
    assert response.status_code == 200
    data = response.json()
    assert data["synthetic_demo"] is True
    assert data["assumptions"]
    for source in data["sources"]:
        assert {"id", "name", "system", "shape", "mode", "notes"} <= set(source)
    for row in data["rates"]:
        assert {"class", "field", "value", "basis", "confidence", "citation"} <= set(row)


def test_sourced_rows_carry_a_confidence_and_citation():
    data = sources.load_sources()
    sourced = [row for row in data["rates"] if row["basis"] == "sourced"]
    assert sourced
    for row in sourced:
        assert row["confidence"] in {"medium", "high", "low-medium"}
        assert row["citation"]
