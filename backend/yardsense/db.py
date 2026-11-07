"""SQLite access: connect, reset from seed, and read the data back."""
import json
import os
import sqlite3
import threading
from pathlib import Path

from .config import SEED_DIR, load_rates
from .connectors import ProcoreConnector, SAPConnector

SCHEMA = Path(__file__).with_name("schema.sql")
DEFAULT_DB = Path(__file__).resolve().parents[1] / "yardsense.db"
TABLES = ["assignments", "settings", "rates", "needs", "phases", "projects",
          "assets", "sites", "companies"]  # drop order: children first
_DB_INIT_LOCK = threading.RLock()


def get_conn():
    """Open the database (path from env YARDSENSE_DB)."""
    conn = sqlite3.connect(os.environ.get("YARDSENSE_DB") or DEFAULT_DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _seed_json(name):
    with open(SEED_DIR / name) as f:
        return json.load(f)


def _reset_db():
    """Drop every table, rebuild from schema.sql and load the seed through the connectors."""
    assets = SAPConnector(SEED_DIR / "sap_assets.json").get_assets()
    projects = ProcoreConnector(SEED_DIR / "procore_projects.json").get_projects()
    rates = load_rates()
    conn = get_conn()
    with conn:
        for table in TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.executescript(SCHEMA.read_text())
        conn.executemany("INSERT INTO companies VALUES (:code, :name, :kind)",
                         _seed_json("companies.json"))
        conn.executemany(
            "INSERT INTO sites VALUES (:id, :name, :kind, :company, :address, :lat, :lon)",
            _seed_json("sites.json"))
        conn.executemany(
            "INSERT INTO assets VALUES (:asset_id, :description, :asset_class, :company, :acquired, :cost)",
            assets)
        for p in projects:
            conn.execute(
                "INSERT INTO projects VALUES (:id, :project_number, :name, :company, :site_id,"
                " :start_date, :completion_date)", p)
            for ph in p["phases"]:
                conn.execute("INSERT INTO phases (project_id, task_name, start, finish)"
                             " VALUES (?, ?, ?, ?)", (p["id"], ph["task_name"], ph["start"], ph["finish"]))
            for n in p["needs"]:
                conn.execute("INSERT INTO needs (project_id, asset_class, qty, start, finish, phase)"
                             " VALUES (?, ?, ?, ?, ?, ?)",
                             (p["id"], n["asset_class"], n["qty"], n["start"], n["finish"], n["phase"]))
        for code, c in rates["classes"].items():
            conn.execute(
                "INSERT INTO rates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (code, c["label"], c["outside"]["day"], c["outside"]["week"], c["outside"]["month"],
                 c["outside_delivery_fee"], c["internal"]["day"], c["internal"]["week"],
                 c["internal"]["month"], c["purchase_price"], c["resale_pct_per_year"],
                 c["maintenance_month"], c["insurance_month"], c["wear_per_day"]))
        for key, value in rates["settings"].items():
            conn.execute("INSERT INTO settings VALUES (?, ?)", (key, json.dumps(value)))
        conn.executemany(
            "INSERT INTO assignments (asset_id, project_id, site_id, checked_out, checked_in)"
            " VALUES (:asset_id, :project_id, :site_id, :checked_out, :checked_in)",
            _seed_json("assignments.json"))
    conn.close()


def reset_db():
    """Drop every table, rebuild from schema.sql and load the seed through the connectors."""
    with _DB_INIT_LOCK:
        _reset_db()


def ensure_db():
    """Build the database from seed if it does not exist yet."""
    with _DB_INIT_LOCK:
        conn = get_conn()
        has_tables = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='assets'").fetchone()
        conn.close()
        if not has_tables:
            reset_db()


def _rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params)]


def get_projects():
    """Projects with nested phases and needs (needs use the key 'class')."""
    ensure_db()
    conn = get_conn()
    projects = _rows(conn, "SELECT * FROM projects ORDER BY start_date")
    for p in projects:
        p["phases"] = _rows(conn, "SELECT task_name, start, finish FROM phases"
                                  " WHERE project_id = ? ORDER BY start", (p["id"],))
        p["needs"] = _rows(conn, "SELECT asset_class AS class, qty, start, finish, phase FROM needs"
                                 " WHERE project_id = ? ORDER BY start", (p["id"],))
    conn.close()
    return projects


def get_assets():
    ensure_db()
    conn = get_conn()
    rows = _rows(conn, "SELECT * FROM assets ORDER BY asset_id")
    conn.close()
    return rows


def get_sites():
    ensure_db()
    conn = get_conn()
    rows = _rows(conn, "SELECT * FROM sites ORDER BY id")
    conn.close()
    return rows


def get_assignments():
    ensure_db()
    return _rows_of("assignments")


def create_assignment(asset_id, project_id, site_id, checked_out):
    conn = get_conn()
    with conn:
        cursor = conn.execute(
            "INSERT INTO assignments (asset_id, project_id, site_id, checked_out, checked_in)"
            " VALUES (?, ?, ?, ?, NULL)",
            (asset_id, project_id, site_id, checked_out))
        row = conn.execute("SELECT * FROM assignments WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(row)


def check_in_assignment(assignment_id, checked_in):
    conn = get_conn()
    with conn:
        conn.execute("UPDATE assignments SET checked_in = ? WHERE id = ?",
                     (checked_in, assignment_id))
        row = conn.execute("SELECT * FROM assignments WHERE id = ?", (assignment_id,)).fetchone()
    conn.close()
    return dict(row)


def load_world():
    """Everything the engine needs, as plain dicts (the same shape as before the DB)."""
    ensure_db()
    conn = get_conn()
    settings = {r["key"]: json.loads(r["value"]) for r in conn.execute("SELECT * FROM settings")}
    classes = {}
    for r in conn.execute("SELECT * FROM rates"):
        classes[r["asset_class"]] = {
            "label": r["label"],
            "outside": {k: r["outside_" + k] for k in ("day", "week", "month")},
            "outside_delivery_fee": r["outside_delivery_fee"],
            "internal": {k: r["internal_" + k] for k in ("day", "week", "month")},
            "purchase_price": r["purchase_price"],
            "resale_pct_per_year": r["resale_pct_per_year"],
            "maintenance_month": r["maintenance_month"],
            "insurance_month": r["insurance_month"],
            "wear_per_day": r["wear_per_day"],
        }
    conn.close()
    projects = get_projects()
    for p in projects:
        p["planned_equipment"] = p["needs"]
    return {"settings": settings, "classes": classes, "companies": _rows_of("companies"),
            "sites": get_sites(), "assets": get_assets(), "assignments": get_assignments(),
            "projects": projects}


def _rows_of(table):
    conn = get_conn()
    rows = _rows(conn, f"SELECT * FROM {table}")
    conn.close()
    return rows
