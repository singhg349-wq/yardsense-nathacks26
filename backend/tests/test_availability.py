"""Availability and check-out/in behavior through the running app."""

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.main import app


def available(client, start, finish):
    response = client.get("/assets/available", params={"from": start, "to": finish})
    assert response.status_code == 200
    return {asset["asset_id"]: asset for asset in response.json()}


def available_with_shifts(client, start, finish, shifts):
    response = client.post("/assets/available",
                           json={"start": start, "finish": finish, "shifts": shifts})
    assert response.status_code == 200
    return {asset["asset_id"]: asset for asset in response.json()}


def test_shifted_availability_matches_the_baseline_without_shifts():
    client = TestClient(app)
    assert available_with_shifts(client, "2026-11-23", "2027-01-31", []) == \
        available(client, "2026-11-23", "2027-01-31")


def test_shifted_availability_follows_a_what_if_schedule():
    client = TestClient(app)
    baseline = available_with_shifts(client, "2026-11-23", "2027-01-31", [])
    shifted = available_with_shifts(client, "2026-11-23", "2027-01-31",
                                    [{"project_id": "PRJ-WGT", "days": 84}])
    assert set(shifted) != set(baseline)


def test_shifted_availability_validates_dates_and_projects():
    client = TestClient(app)
    assert client.post("/assets/available", json={
        "start": "2026-12-02", "finish": "2026-12-01", "shifts": []}).status_code == 422
    assert client.post("/assets/available", json={
        "start": "2026-12-01", "finish": "2026-12-02",
        "shifts": [{"project_id": "missing", "days": 7}]}).status_code == 404


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


def test_past_project_phase_does_not_release_a_new_checkout():
    client = TestClient(app)
    response = client.post("/assignments", json={
        "asset_id": "100017", "project_id": "PRJ-WGT",
        "site_id": "S-WGT", "checked_out": "2026-11-23"})
    assert response.status_code == 201
    assert "100017" not in available(client, "2026-11-24", "2026-11-24")


def test_checkout_before_a_future_booking_cannot_overlap_it():
    client = TestClient(app)
    booking = {"asset_id": "100004", "site_id": "S-EX1"}
    assert client.post("/assignments", json={**booking,
                                               "checked_out": "2027-12-01"}).status_code == 201
    earlier = client.post("/assignments", json={**booking, "checked_out": "2027-11-01"})
    assert earlier.status_code == 409
    assert len([entry for entry in client.get("/assignments").json()
                if entry["asset_id"] == "100004" and
                entry["checked_out"] in {"2027-11-01", "2027-12-01"}]) == 1


def test_project_checkout_can_be_followed_after_its_scheduled_need():
    client = TestClient(app)
    first = client.post("/assignments", json={"asset_id": "100004", "project_id": "PRJ-RIV",
                                                  "site_id": "S-RIV", "checked_out": "2026-11-23"})
    assert first.status_code == 201
    later = client.post("/assignments", json={"asset_id": "100004", "site_id": "S-EX1",
                                                  "checked_out": "2027-02-01"})
    assert later.status_code == 201


def test_simultaneous_checkouts_reserve_one_unit_once():
    booking = {"asset_id": "100004", "site_id": "S-EX1", "checked_out": "2027-11-01"}

    def checkout(_):
        return TestClient(app).post("/assignments", json=booking).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(checkout, range(2)))
    assert statuses == [201, 409]
