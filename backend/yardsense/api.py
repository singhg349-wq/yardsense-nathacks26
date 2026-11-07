"""HTTP routes. Anant's main.py will call app.include_router(router)."""
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from . import availability, cost_model, db

router = APIRouter()

OWNED_BY_RENTALS = "NR01"


class RecommendRequest(BaseModel):
    project_id: str
    items: list[dict]


class CheckoutRequest(BaseModel):
    asset_id: str
    project_id: str | None = None
    site_id: str
    checked_out: date


class CheckinRequest(BaseModel):
    checked_in: date


# The engine reads everything from the database (see db.load_world).
def load_world():
    return db.load_world()


# The hard-coded request used when no body is sent (Priya's Monday call).
DEFAULT_REQUEST = {
    "project_id": "PRJ-RIV",
    "items": [
        {"class": "SCISSOR_19", "qty": 2, "start": "2026-11-23", "finish": "2027-01-31"},
        {"class": "TELEHANDLER", "qty": 1, "start": "2026-11-23", "finish": "2027-01-31"},
        {"class": "GEN_45KW", "qty": 1, "start": "2026-11-23", "finish": "2027-01-31"},
    ],
}


def pipeline_for(world, cls):
    """(start, finish) for every planned need of this class, repeated per unit of qty."""
    out = []
    for p in world["projects"]:
        for n in p["planned_equipment"]:
            if n["class"] == cls:
                span = (date.fromisoformat(n["start"]), date.fromisoformat(n["finish"]))
                out.extend([span] * n["qty"])
    return out


def recommend(world, body):
    """Rank the options for every item in the request."""
    settings = world["settings"]
    projects = {p["id"]: p for p in world["projects"]}
    sites = {s["id"]: s for s in world["sites"]}
    site = sites[projects[body["project_id"]]["site_id"]]
    results = []
    for item in body["items"]:
        cls = item["class"]
        req = {"class": cls, "qty": item.get("qty", 1),
               "start": date.fromisoformat(item["start"]),
               "finish": date.fromisoformat(item["finish"]),
               "dest": (site["lat"], site["lon"])}
        idle = availability.available_units(world, req["start"], req["finish"], cls)
        options = cost_model.price_options(
            req, world["classes"][cls], settings,
            [u for u in idle if u["company"] != OWNED_BY_RENTALS],
            [u for u in idle if u["company"] == OWNED_BY_RENTALS],
            pipeline_for(world, cls))
        results.append({"class": cls, "qty": req["qty"], "options": cost_model.rank(options)})
    return {"project_id": body["project_id"], "items": results}


@router.post("/recommend")
def post_recommend(body: RecommendRequest | None = None):
    """Ranked options for a request. No body = the hard-coded Riverside request."""
    payload = body.model_dump() if body else DEFAULT_REQUEST
    return recommend(load_world(), payload)


@router.get("/projects")
def get_projects():
    """All projects with nested phases and planned equipment needs."""
    return db.get_projects()


@router.get("/assets")
def get_assets():
    """The SAP-style asset register, in internal field names."""
    return db.get_assets()


@router.get("/sites")
def get_sites():
    """Yards and project sites with coordinates."""
    return db.get_sites()


@router.get("/assets/available")
def get_available_assets(start: date = Query(alias="from"), finish: date = Query(alias="to")):
    if finish < start:
        raise HTTPException(422, "'to' must be on or after 'from'")
    return availability.available_units(load_world(), start, finish)


@router.post("/assignments", status_code=201)
def post_assignment(body: CheckoutRequest):
    world = load_world()
    assets = {asset["asset_id"]: asset for asset in world["assets"]}
    sites = {site["id"]: site for site in world["sites"]}
    projects = {project["id"]: project for project in world["projects"]}
    if body.asset_id not in assets or body.site_id not in sites:
        raise HTTPException(404, "Asset or site not found")
    if body.project_id is not None:
        if body.project_id not in projects:
            raise HTTPException(404, "Project not found")
        if projects[body.project_id]["site_id"] != body.site_id:
            raise HTTPException(422, "Project and site do not match")
    if not any(asset["asset_id"] == body.asset_id for asset in
               availability.available_units(world, body.checked_out, body.checked_out)):
        raise HTTPException(409, "Asset is already assigned on that date")
    return db.create_assignment(body.asset_id, body.project_id, body.site_id,
                                body.checked_out.isoformat())


@router.patch("/assignments/{assignment_id}")
def patch_assignment(assignment_id: int, body: CheckinRequest):
    assignment = next((entry for entry in db.get_assignments()
                       if entry["id"] == assignment_id), None)
    if assignment is None:
        raise HTTPException(404, "Assignment not found")
    if assignment["checked_in"] is not None:
        raise HTTPException(409, "Asset is already checked in")
    if body.checked_in < date.fromisoformat(assignment["checked_out"]):
        raise HTTPException(422, "Check-in cannot precede check-out")
    return db.check_in_assignment(assignment_id, body.checked_in.isoformat())
