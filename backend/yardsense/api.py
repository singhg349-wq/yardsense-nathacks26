"""HTTP routes. Anant's main.py will call app.include_router(router)."""
import json
from datetime import date, timedelta

from fastapi import APIRouter
from pydantic import BaseModel

from . import cost_model
from .config import SEED_DIR, load_rates

router = APIRouter()

OWNED_BY_RENTALS = "NR01"


class RecommendRequest(BaseModel):
    project_id: str
    items: list[dict]


def _read(name):
    with open(SEED_DIR / name) as f:
        return json.load(f)


def load_world():
    """Everything the engine needs, as plain dicts.

    #4 replaces this with a read from the database; the shape stays the same.
    """
    rates = load_rates()
    assets = [{"asset_id": r["ANLN1"], "description": r["TXT50"], "asset_class": r["ANLKL"],
               "company": r["BUKRS"], "acquired": r["AKTIV"], "cost": r["ANSWL"]}
              for r in _read("sap_assets.json")]
    return {"settings": rates["settings"], "classes": rates["classes"],
            "companies": _read("companies.json"), "sites": _read("sites.json"),
            "assets": assets, "assignments": _read("assignments.json"),
            "projects": _read("procore_projects.json")}


# The hard-coded request used when no body is sent (Priya's Monday call).
DEFAULT_REQUEST = {
    "project_id": "PRJ-RIV",
    "items": [
        {"class": "SCISSOR_19", "qty": 2, "start": "2026-11-23", "finish": "2027-01-31"},
        {"class": "TELEHANDLER", "qty": 1, "start": "2026-11-23", "finish": "2027-01-31"},
        {"class": "GEN_45KW", "qty": 1, "start": "2026-11-23", "finish": "2027-01-31"},
    ],
}


def find_idle_units(world, cls, today):
    """Units of a class that are free right now.

    Idle means: no open check-out in the log, or checked out to a project that has
    no need of this class on or after today. A unit rented to an outside customer is busy.
    """
    sites = {s["id"]: s for s in world["sites"]}
    projects = {p["id"]: p for p in world["projects"]}
    yards = {s["company"]: s for s in world["sites"] if s["kind"] == "yard"}
    open_log = {a["asset_id"]: a for a in world["assignments"] if a["checked_in"] is None}
    idle = []
    for asset in world["assets"]:
        if asset["asset_class"] != cls:
            continue
        log = open_log.get(asset["asset_id"])
        if log is None:
            site, since = yards[asset["company"]], None
        else:
            site, since = sites[log["site_id"]], None
            project = projects.get(log["project_id"])
            if project is None:
                continue  # rented out to a customer
            needs = [n for n in project["planned_equipment"] if n["class"] == cls]
            if any(date.fromisoformat(n["finish"]) >= today for n in needs):
                continue  # project still needs it
            since = max((date.fromisoformat(n["finish"]) for n in needs), default=None)
        where = f"at {site['name']}"
        if since:
            where = f"at {site['name']} since {since.strftime('%b')} {since.day}"
        idle.append({"asset_id": asset["asset_id"], "company": asset["company"],
                     "lat": site["lat"], "lon": site["lon"], "where": where})
    return idle


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
    today = date.fromisoformat(settings["demo_today"])
    projects = {p["id"]: p for p in world["projects"]}
    sites = {s["id"]: s for s in world["sites"]}
    site = sites[projects[body["project_id"]]["site_id"]]
    results = []
    for item in body["items"]:
        cls = item["class"]
        idle = find_idle_units(world, cls, today)
        req = {"class": cls, "qty": item.get("qty", 1),
               "start": date.fromisoformat(item["start"]),
               "finish": date.fromisoformat(item["finish"]),
               "dest": (site["lat"], site["lon"])}
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
