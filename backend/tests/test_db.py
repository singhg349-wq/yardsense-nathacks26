"""Tests for the schema, the connectors and the GET routes (temp DB from conftest)."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from yardsense import api, db
from yardsense.config import SEED_DIR
from yardsense.connectors import ProcoreConnector, SAPConnector


def count(table):
    conn = db.get_conn()
    n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()
    return n


def test_reset_fills_every_table():
    for table in ["companies", "sites", "assets", "projects", "phases", "needs",
                  "rates", "assignments"]:
        assert count(table) > 0, table


def test_reset_twice_does_not_duplicate_rows():
    before = count("assets")
    db.reset_db()
    assert count("assets") == before


def test_sap_connector_maps_field_names():
    assets = SAPConnector(SEED_DIR / "sap_assets.json").get_assets()
    assert len(assets) >= 40
    assert set(assets[0]) == {"asset_id", "description", "asset_class", "company", "acquired", "cost"}


def test_procore_connector_returns_phases_and_needs():
    projects = ProcoreConnector(SEED_DIR / "procore_projects.json").get_projects()
    assert len(projects) == 5
    assert projects[0]["phases"] and projects[0]["needs"]


def test_get_routes_return_data():
    app = FastAPI()
    app.include_router(api.router)
    client = TestClient(app)
    for path in ["/projects", "/assets", "/sites"]:
        response = client.get(path)
        assert response.status_code == 200
        assert len(response.json()) > 0, path
    project = client.get("/projects").json()[0]
    assert project["phases"] and project["needs"]
