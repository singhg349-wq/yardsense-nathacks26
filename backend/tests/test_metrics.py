"""The dashboard counts real fleet days, not purchased demo units."""

from fastapi.testclient import TestClient

from app.main import app


def test_dashboard_reports_twelve_week_fleet_utilization():
    response = TestClient(app).post("/dashboard", json={"shifts": []})
    assert response.status_code == 200
    data = response.json()
    assert data["horizon_start"] == "2026-11-16"
    assert data["fleet_assets"] == 53
    assert data["fleet_days"] == 53 * 84
    assert 0 < data["idle_days"] < data["fleet_days"]
    assert sum(row["idle_days"] for row in data["idle_by_class"]) == data["idle_days"]
