"""A multi-unit need can be split: idle units first, the rest outside or bought."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from yardsense import allocator, cost_model, db

INTERNAL = {"move_ours", "rent_sister"}


@pytest.fixture(scope="module")
def plan():
    return allocator.build_plan(db.load_world())


def row_for(plan, project_id, asset_class):
    return next(row for row in plan
                if row["project_id"] == project_id and row["class"] == asset_class)


@pytest.mark.parametrize("asset_class", ["TELEHANDLER", "BOOM_60"])
def test_whitemud_uses_the_idle_unit_and_covers_only_the_rest(plan, asset_class):
    row = row_for(plan, "PRJ-WMD", asset_class)
    assert row["qty"] == 2
    assert row["option"] == "split"
    assert [(part["option"], part["qty"]) for part in row["units"]] == [
        ("move_ours", 1), ("buy", 1)]
    split = row["options"][0]
    assert split["option"] == "split" and split["available"]
    # The split beats renting both units outside, which the old plan chose.
    outside = next(option for option in row["options"] if option["option"] == "rent_outside")
    assert split["group_cost"] < outside["group_cost"]
    assert split["kept_in_group"] == pytest.approx(outside["group_cost"] - split["group_cost"])
    # Totals and ids add up from the parts.
    assert split["group_cost"] == pytest.approx(sum(p["group_cost"] for p in split["units"]))
    assert split["project_cost"] == pytest.approx(sum(p["project_cost"] for p in split["units"]))
    assert row["asset_ids"] == [asset for part in row["units"] for asset in part["asset_ids"]]
    assert len(row["asset_ids"]) == 2
    assert [move["asset_id"] for move in row["moves"]] == row["units"][0]["asset_ids"]
    assert row["units"][1]["asset_ids"][0].startswith(f"BUY-{asset_class}-")
    assert "1 x move ours + 1 x buy" in split["reason"]
    # The single-source options stay listed, unavailable, with their own reasons.
    names = [option["option"] for option in row["options"]]
    assert sorted(names) == ["buy", "move_ours", "rent_outside", "rent_sister", "split"]


def test_no_unit_is_double_booked_with_splits(plan):
    assert any(row["option"] == "split" for row in plan)
    bookings = {}
    for row in plan:
        assert len(row["asset_ids"]) == row["qty"] - sum(
            part["qty"] for part in row["units"] if part["option"] == "rent_outside")
        assert len(set(row["asset_ids"])) == len(row["asset_ids"])
        start, finish = date.fromisoformat(row["start"]), date.fromisoformat(row["finish"])
        for asset_id in row["asset_ids"]:
            for old_start, old_finish in bookings.get(asset_id, []):
                assert finish < old_start or start > old_finish, asset_id
            bookings.setdefault(asset_id, []).append((start, finish))


def test_units_cover_every_requested_unit(plan):
    for row in plan:
        assert sum(part["qty"] for part in row["units"]) == row["qty"]
        assert row["group_cost"] == pytest.approx(
            sum(part["group_cost"] for part in row["units"]), abs=0.01)
        if row["option"] != "split":
            assert [part["option"] for part in row["units"]] == [row["option"]]


def test_single_unit_needs_are_never_split(plan):
    singles = [row for row in plan if row["qty"] == 1]
    assert singles
    for row in singles:
        assert row["option"] != "split"
        assert len(row["options"]) == 4
    riverside = row_for(plan, "PRJ-RIV", "TELEHANDLER")
    assert riverside["option"] == "move_ours"
    assert riverside["units"] == [{"option": "move_ours", "qty": 1,
                                   "asset_ids": riverside["asset_ids"],
                                   "group_cost": riverside["group_cost"]}]


def test_full_internal_fill_is_not_reported_as_split(plan):
    scissors = row_for(plan, "PRJ-RIV", "SCISSOR_19")
    assert scissors["qty"] == 2
    assert scissors["option"] == "rent_sister"
    assert all(option["option"] != "split" for option in scissors["options"])


def test_split_option_needs_two_sources():
    world = db.load_world()
    cls, settings = world["classes"]["TELEHANDLER"], world["settings"]
    site = world["sites"][0]
    request = {"class": "TELEHANDLER", "qty": 1, "start": date(2027, 2, 1),
               "finish": date(2027, 3, 1), "site_id": site["id"],
               "dest": (site["lat"], site["lon"])}
    unit = {"asset_id": "X1", "company": "NB01", "site_id": site["id"],
            "lat": site["lat"], "lon": site["lon"], "where": "here"}
    assert allocator.split_option(request, cls, settings, [unit], [], None, 1e9) is None
    request = {**request, "qty": 2}
    split = allocator.split_option(request, cls, settings, [unit], [], None, 1e9)
    # No pipeline, so buy cannot break even: the rest is rented outside.
    assert [(part["option"], part["qty"]) for part in split["units"]] == [
        ("move_ours", 1), ("rent_outside", 1)]
    outside_one = cost_model.rental_price(29, cls["outside"]) + cls["outside_delivery_fee"]
    assert split["units"][1]["group_cost"] == pytest.approx(outside_one)


def test_recommend_returns_the_split_for_whitemud():
    body = {"project_id": "PRJ-WMD", "items": [
        {"class": "TELEHANDLER", "qty": 2, "start": "2027-02-01", "finish": "2027-08-27"}]}
    item = TestClient(app).post("/recommend", json=body).json()["items"][0]
    top = item["options"][0]
    assert top["option"] == "split"
    assert [(part["option"], part["qty"]) for part in top["units"]] == [
        ("move_ours", 1), ("buy", 1)]
    assert {"option", "qty", "group_cost", "project_cost", "reason",
            "breakdown", "asset_ids", "moves"} <= set(top["units"][0])
