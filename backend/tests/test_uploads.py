"""CSV imports change the same SQLite world used by recommendations."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from yardsense import api, db
from yardsense.config import REPO_ROOT

SAMPLES = REPO_ROOT / "data" / "samples"


def client():
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app)


def upload(browser, source, content):
    return browser.post(f"/uploads/{source}", content=content,
                        headers={"Content-Type": "text/csv"})


def test_sample_uploads_update_recommendations_and_schedule():
    browser = client()
    before = browser.post("/recommend").json()
    sample = browser.get("/samples/sap")
    assert sample.status_code == 200
    response = upload(browser, "sap", sample.content)
    assert response.status_code == 200
    assert response.json() == {"source": "sap", "imported": 54}
    assert any(asset["asset_id"] == "199999" for asset in browser.get("/assets").json())
    after = browser.post("/recommend").json()
    assert before["items"][2]["options"][0]["option"] != after["items"][2]["options"][0]["option"]

    schedule = (SAMPLES / "procore_schedule.csv").read_bytes()
    for _ in range(2):
        response = upload(browser, "procore", schedule)
        assert response.status_code == 200
        assert response.json() == {"source": "procore", "imported": 5}
    kingsway = next(p for p in browser.get("/projects").json() if p["id"] == "PRJ-KNG")
    assert kingsway["start_date"] == "2026-09-14"
    assert len(kingsway["phases"]) == 5
    assert len(kingsway["needs"]) == 6
    assert browser.get("/plan").status_code == 200


def test_invalid_csv_reports_columns_and_preserves_database():
    browser = client()
    before = len(browser.get("/assets").json())
    missing = upload(browser, "sap", b"ANLN1,TXT50\n1,Generator\n")
    assert missing.status_code == 422
    assert "Missing columns: ANLKL, BUKRS, AKTIV, ANSWL" in missing.json()["detail"]
    invalid = upload(browser, "sap", b"ANLN1,TXT50,ANLKL,BUKRS,AKTIV,ANSWL\n"
                     b"199999,Generator,GEN_45KW,NB01,2026-10-01,52500\n"
                     b"200000,Lift,UNKNOWN,NB01,2026-10-01,1000\n")
    assert invalid.status_code == 422
    assert "Row 3: unknown equipment class UNKNOWN" in invalid.json()["detail"]
    assert len(browser.get("/assets").json()) == before


def test_bad_schedule_does_not_partially_update_projects():
    browser = client()
    original = next(p for p in browser.get("/projects").json() if p["id"] == "PRJ-KNG")
    content = (SAMPLES / "procore_schedule.csv").read_text().replace("TELEHANDLER", "UNKNOWN", 1).encode()
    response = upload(browser, "procore", content)
    assert response.status_code == 422
    assert "unknown equipment class UNKNOWN" in response.json()["detail"]
    current = next(p for p in browser.get("/projects").json() if p["id"] == "PRJ-KNG")
    assert current == original
