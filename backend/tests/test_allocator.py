"""The group plan reserves real units and reacts to schedule changes."""

from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from yardsense import allocator, api, db


def test_plan_never_double_books_a_physical_unit():
    response = TestClient(app).get("/plan")
    assert response.status_code == 200
    allocations = response.json()["allocations"]
    assert allocations
    riverside = {row["class"]: row for row in allocations
                 if row["project_id"] == "PRJ-RIV"}
    assert riverside["SCISSOR_19"]["option"] == "rent_sister"
    assert riverside["TELEHANDLER"]["option"] == "move_ours"
    assert riverside["GEN_45KW"]["option"] == "buy"
    bookings = {}
    for row in allocations:
        for asset_id in row["asset_ids"]:
            start, finish = date.fromisoformat(row["start"]), date.fromisoformat(row["finish"])
            for old_start, old_finish in bookings.get(asset_id, []):
                assert finish < old_start or start > old_finish, asset_id
            bookings.setdefault(asset_id, []).append((start, finish))


def test_six_week_slip_flips_riverside_generator():
    client = TestClient(app)
    baseline = client.get("/plan").json()
    shifted = client.post("/plan", json={"shifts": [
        {"project_id": "PRJ-KNG", "days": 42}]}).json()
    def generator(plan):
        return next(row for row in plan["allocations"]
                    if row["project_id"] == "PRJ-RIV" and row["class"] == "GEN_45KW")
    assert generator(baseline)["option"] == "buy"
    assert generator(shifted)["option"] == "rent_outside"
    assert any(change["request_id"] == generator(shifted)["request_id"]
               and change["from_option"] == "buy"
               and change["to_option"] == "rent_outside"
               for change in shifted["changed"])
    assert next(project for project in shifted["projects"]
                if project["id"] == "PRJ-KNG")["start_date"] == "2026-09-14"


def test_plan_rejects_unknown_project():
    response = TestClient(app).post("/plan", json={"shifts": [
        {"project_id": "missing", "days": 42}]})
    assert response.status_code == 404


def test_request_recommendations_match_the_shifted_group_plan():
    world = allocator.shifted_world(db.load_world(), [{"project_id": "PRJ-KNG", "days": 42}])
    body = {"project_id": "PRJ-RIV", "items": [
        {"class": "SCISSOR_19", "qty": 2,
         "start": "2026-11-23", "finish": "2027-01-31"},
        {"class": "GEN_45KW", "qty": 1,
         "start": "2026-11-23", "finish": "2027-01-31"},
    ]}
    recommendations = api.recommend(world, body)["items"]
    plan = allocator.build_plan(world)
    by_class = {row["class"]: row for row in plan if row["project_id"] == "PRJ-RIV"}
    for item in recommendations:
        assert item["options"][0]["option"] == by_class[item["class"]]["option"]
