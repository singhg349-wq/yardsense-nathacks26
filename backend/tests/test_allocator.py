"""The group plan reserves real units and reacts to schedule changes."""

import json
from datetime import date
from pathlib import Path

import pytest
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
    assert riverside["GEN_45KW"]["option"] == "rent_outside"
    bookings = {}
    for row in allocations:
        for asset_id in row["asset_ids"]:
            start, finish = date.fromisoformat(row["start"]), date.fromisoformat(row["finish"])
            for old_start, old_finish in bookings.get(asset_id, []):
                assert finish < old_start or start > old_finish, asset_id
            bookings.setdefault(asset_id, []).append((start, finish))


def test_six_week_slip_flips_riverside_scissors():
    client = TestClient(app)
    baseline = client.get("/plan").json()
    shifted = client.post("/plan", json={"shifts": [
        {"project_id": "PRJ-KNG", "days": 42}]}).json()
    def scissors(plan):
        return next(row for row in plan["allocations"]
                    if row["project_id"] == "PRJ-RIV" and row["class"] == "SCISSOR_19")
    assert scissors(baseline)["option"] == "rent_sister"
    assert scissors(shifted)["option"] == "rent_outside"
    assert any(change["request_id"] == scissors(shifted)["request_id"]
               and change["from_option"] == "rent_sister"
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


SEED_SITES = {site["id"] for site in json.loads(
    (Path(__file__).resolve().parents[2] / "data" / "seed" / "sites.json").read_text())}
MOVE_OPTIONS = {"move_ours", "rent_sister"}


def move_allocations(plan):
    return [row for row in plan["allocations"] if row["option"] in MOVE_OPTIONS]


def transport_amount(option):
    return next(line["amount"] for line in option["breakdown"] if line["label"] == "Transport")


def test_moves_sum_to_transport_and_use_real_sites():
    allocations = move_allocations(TestClient(app).get("/plan").json())
    assert len(allocations) == 3
    for row in allocations:
        chosen = next(option for option in row["options"] if option["option"] == row["option"])
        assert [move["asset_id"] for move in row["moves"]] == row["asset_ids"]
        # Each unit is rounded to cents on its own, so allow a cent per unit.
        assert sum(move["transport_cost"] for move in row["moves"]) == pytest.approx(
            transport_amount(chosen), abs=0.01 * len(row["moves"]))
        for move in row["moves"]:
            assert move["from_site_id"] in SEED_SITES
            assert move["to_site_id"] == row["site_id"]
            assert set(move) == {"asset_id", "from_site_id", "to_site_id", "km", "transport_cost"}
            assert move["km"] == round(move["km"], 1)
            assert move["transport_cost"] == round(move["transport_cost"], 2)


def test_non_move_allocations_have_no_moves():
    allocations = TestClient(app).get("/plan").json()["allocations"]
    others = [row for row in allocations
              if row["option"] not in MOVE_OPTIONS and row["option"] != "split"]
    assert others
    assert all(row["moves"] == [] for row in others)


def test_a_unit_moved_twice_leaves_from_its_previous_booking():
    allocations = TestClient(app).get("/plan").json()["allocations"]
    capilano = next(row for row in allocations
                    if row["project_id"] == "PRJ-CAP" and row["class"] == "SCISSOR_19")
    assert capilano["moves"][0]["from_site_id"] == "S-RIV"


def test_post_plan_with_shifts_carries_moves():
    plan = TestClient(app).post("/plan", json={"shifts": [
        {"project_id": "PRJ-KNG", "days": 42}]}).json()
    allocations = move_allocations(plan)
    assert allocations
    assert all(row["moves"] for row in allocations)


def test_recommend_options_name_the_destination_site():
    items = TestClient(app).post("/recommend").json()["items"]
    telehandler = next(item for item in items if item["class"] == "TELEHANDLER")
    move = telehandler["options"][0]["moves"][0]
    assert move["from_site_id"] == "S-WGT"
    assert move["to_site_id"] == "S-RIV"


def test_get_assignments_returns_the_log():
    rows = TestClient(app).get("/assignments").json()
    still_out = [row for row in rows if row["checked_in"] is None]
    assert len(still_out) == 51
    assert sum(row["project_id"] is None for row in still_out) == 30
    assert {"asset_id", "project_id", "site_id", "checked_out", "checked_in"} <= set(rows[0])
