"""Availability and check-out/in behavior through the running app."""

from fastapi.testclient import TestClient

from app.main import app


def available(client, start, finish):
    response = client.get("/assets/available", params={"from": start, "to": finish})
    assert response.status_code == 200
    return {asset["asset_id"]: asset for asset in response.json()}


def test_schedule_releases_a_unit_only_after_its_need_ends():
    client = TestClient(app)
    assert "100017" not in available(client, "2026-11-01", "2026-11-30")
    unit = available(client, "2026-11-23", "2027-01-31")["100017"]
    assert unit["site_id"] == "S-WGT"
    assert "since Nov 6" in unit["where"]


def test_checkout_blocks_overlap_and_checkin_releases_unit():
    client = TestClient(app)
    body = {"asset_id": "100004", "project_id": "PRJ-RIV",
            "site_id": "S-RIV", "checked_out": "2026-11-23"}
    response = client.post("/assignments", json=body)
    assert response.status_code == 201
    assignment_id = response.json()["id"]
    assert "100004" not in available(client, "2026-11-23", "2026-12-05")
    assert client.post("/assignments", json=body).status_code == 409

    response = client.patch(f"/assignments/{assignment_id}",
                            json={"checked_in": "2026-12-01"})
    assert response.status_code == 200
    assert "100004" in available(client, "2026-12-02", "2026-12-05")
    assert client.patch(f"/assignments/{assignment_id}",
                        json={"checked_in": "2026-12-02"}).status_code == 409


def test_invalid_availability_dates_and_assignment_links():
    client = TestClient(app)
    assert client.get("/assets/available", params={"from": "2026-12-02",
                                                  "to": "2026-12-01"}).status_code == 422
    assert client.post("/assignments", json={"asset_id": "100004",
                                                  "project_id": "PRJ-RIV",
                                                  "site_id": "S-WGT",
                                                  "checked_out": "2026-11-23"}).status_code == 422
