"""The committed road table prices moves without a routing call at runtime."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from yardsense import api, cost_model, db


def test_seed_matrix_covers_every_directed_site_pair():
    world = db.load_world()
    matrix = world["road_distances"]
    ids = {site["id"] for site in world["sites"]}
    assert set(matrix["coordinates"]) == ids
    assert set(matrix["distances_km"]) == ids
    assert all(set(row) == ids for row in matrix["distances_km"].values())
    assert all(distance is not None and distance >= 0
               for row in matrix["distances_km"].values() for distance in row.values())
    assert matrix["distances_km"]["Y-NR"]["S-RIV"] == pytest.approx(12.057, abs=0.001)


def test_plan_and_request_use_road_km_and_truck_cost():
    app = FastAPI()
    app.include_router(api.router)
    client = TestClient(app)
    world = db.load_world()
    km = world["road_distances"]["distances_km"]["S-WGT"]["S-RIV"]
    expected_cost = round(150 + 4.5 * km, 2)

    request = client.post("/recommend").json()
    telehandler = next(item for item in request["items"] if item["class"] == "TELEHANDLER")
    move = telehandler["options"][0]
    assert move["moves"][0]["km"] == round(km, 1)
    assert move["moves"][0]["transport_cost"] == expected_cost
    assert f"${expected_cost:,.0f} truck" in move["reason"]

    sister_km = world["road_distances"]["distances_km"]["Y-NR"]["S-RIV"]
    lifts = next(item for item in request["items"] if item["class"] == "SCISSOR_19")
    sister = next(option for option in lifts["options"] if option["option"] == "rent_sister")
    assert len(sister["moves"]) == 2
    assert all(entry["km"] == round(sister_km, 1) for entry in sister["moves"])
    assert all(entry["transport_cost"] == round(150 + 4.5 * sister_km, 2)
               for entry in sister["moves"])

    planned = client.get("/plan").json()["allocations"]
    same_move = next(row for row in planned if row["request_id"] == "PRJ-RIV:1")
    assert same_move["moves"][0]["transport_cost"] == expected_cost


def test_missing_route_or_changed_coordinates_use_straight_line_fallback():
    world = db.load_world()
    sites = {site["id"]: site for site in world["sites"]}
    origin, dest = sites["Y-NR"], sites["S-RIV"]
    unit = {"site_id": origin["id"], "lat": origin["lat"], "lon": origin["lon"]}
    request = {"site_id": dest["id"], "dest": (dest["lat"], dest["lon"])}
    expected = cost_model.road_km(origin["lat"], origin["lon"], dest["lat"], dest["lon"], 1.3)
    assert cost_model.move_km(unit, request, world["settings"], {}) == pytest.approx(expected)
    incomplete = {**world["road_distances"], "distances_km": {"Y-NR": {"S-RIV": None}}}
    assert cost_model.move_km(unit, request, world["settings"], incomplete) == pytest.approx(expected)
    shifted = {**unit, "lat": unit["lat"] + 0.001}
    assert cost_model.move_km(shifted, request, world["settings"], world["road_distances"]) == pytest.approx(
        cost_model.road_km(shifted["lat"], shifted["lon"], *request["dest"], 1.3))


def test_same_site_does_not_dispatch_a_truck():
    world = db.load_world()
    site = next(site for site in world["sites"] if site["id"] == "S-RIV")
    unit = {"site_id": site["id"], "lat": site["lat"], "lon": site["lon"]}
    request = {"site_id": site["id"], "dest": (site["lat"], site["lon"])}
    km = cost_model.move_km(unit, request, world["settings"], world["road_distances"])
    assert km == 0
    assert cost_model.transport_cost(km, world["settings"]) == 0
