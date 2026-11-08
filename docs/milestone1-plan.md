# Milestone 1 build plan (Skeleton gate, Sat Nov 7, 10 AM)

Issues: #3 seed data, #5 cost model, #4 schema + connectors, #6 timeline, #7 pitch v1.
#1 (lanes) is left alone. #2 (skeleton) belongs to Anant: **do not create** `backend/main.py`,
`backend/app.py`, `frontend/package.json`, `frontend/vite.config.*`, `frontend/index.html`,
`frontend/src/main.jsx`, `frontend/src/App.jsx`, `CONTRIBUTING.md` or `DECISIONS.md`.

## Ground rules (every issue)
- Fictional **Northgate Group** only. No real company names or real numbers. All rates are
  placeholders marked `"placeholder": true` and live in `data/seed/rates.json` (one place to swap).
- Python 3.12 stdlib + FastAPI + pytest only. `sqlite3` from stdlib, no ORM. No other deps.
- Frontend: React only, plain CSS, no new npm packages.
- Simple, readable code. Short docstrings. No clever abstractions.
- Never commit `.env*`, `data/private/`, `*.db`, `.venv/`.

## Git flow (one branch per issue, merged into main)
For each issue, in order:
1. `git switch main && git pull` (get teammates' latest)
2. `git switch -c <branch>` (new line of work from main)
3. build, run tests, `git add <files>` (named files only, never `-A`), `git commit`
4. `git switch main && git pull && git merge --no-ff <branch>` (fold the branch into main)
5. `git push origin main <branch>`
If a pull or merge conflicts: stop, do not force anything, report back.
Commit message bodies say `Closes #N`.

| Order | Issue | Branch |
|---|---|---|
| 1 | #3 | `feat/3-seed-data` |
| 2 | #5 | `feat/5-cost-model` |
| 3 | #4 | `feat/4-schema-connectors` |
| 4 | #6 | `feat/6-timeline` |
| parallel | #7 | `docs/7-pitch-v1` |

---

## #3 Seed dataset (`data/seed/`)
Demo "today" = **2026-11-16 (Mon)**, stored as `demo_today` in `rates.json` → `settings`.

Files:
- `companies.json`: `[{code, name, kind}]`. NB01 Northgate Builders (gc), NR01 Northgate
  Rentals (rental), NE01 Northgate Electric (trade).
- `sites.json`: `[{id, name, kind: "yard"|"site", company, address, lat, lon}]`. 2 yards
  (Northgate Builders yard, Northgate Rentals yard) + one site per project. Fictional
  street addresses, real Edmonton-area coordinates (spread across the city, 5-30 km apart).
- `sap_assets.json`: SAP asset-register shape, ~50 rows:
  `{"ANLN1": "100045", "TXT50": "Telehandler 10k lb 55 ft", "ANLKL": "TELEHANDLER",
    "BUKRS": "NB01", "AKTIV": "2021-04-12", "ANSWL": 165000.0}`
  (asset number, description, asset class, company code, capitalization date, acquisition value).
  Classes: `SCISSOR_19`, `BOOM_60`, `TELEHANDLER`, `GEN_45KW`, `HEATER_400K`, `LIGHT_TOWER`,
  `COMPACTOR_PLATE`, `MINI_EX`. Most units owned by NR01, some by NB01, a few by NE01.
- `procore_projects.json`: Procore-like shape:
  `[{id, project_number, name, company, site_id, start_date, completion_date,
     schedule: [{task_name, start, finish}],
     planned_equipment: [{class, qty, start, finish, phase}]}]`
  5 projects: **Riverside Clinic**, **Westgate Tower**, and 3 more (fictional names).
  Some are Northgate Electric jobs or have Electric's crews on them.
- `assignments.json` (Dana's check-out/in log): `[{asset_id, project_id|null, site_id,
  checked_out, checked_in|null}]`. Gives each unit's current location.
- `rates.json`:
  ```
  {"placeholder": true,
   "settings": {"demo_today": "2026-11-16", "horizon_months": 12,
                "max_breakeven_months": 6, "road_factor": 1.3,
                "truck_cost_per_km": 4.5, "truck_base_fee": 150},
   "classes": {"GEN_45KW": {"outside": {"day":..,"week":..,"month":..},
                            "outside_delivery_fee": ..,
                            "internal": {"day":..,"week":..,"month":..},
                            "purchase_price": .., "resale_pct_per_year": ..,
                            "maintenance_month": .., "insurance_month": ..,
                            "wear_per_day": ..}, ...}}
  ```
  Edmonton-plausible placeholder values (internal rate about 10-15% below outside).
- `README.md`: what each file is, its source-system shape, and "to use real numbers:
  put raw files in `data/private/` (gitignored), anonymize, and edit `rates.json` only".

**The seed must make the demo story true** (check this with a small script or the #5 tests):
- Riverside Clinic needs 2× `SCISSOR_19`, 1× `TELEHANDLER`, 1× `GEN_45KW` for 10 weeks
  from 2026-11-23.
- NB01's telehandler is checked out to Westgate Tower, whose framing phase ended before
  demo_today, and Westgate has no later telehandler need → it's idle.
- NR01 has ≥2 `SCISSOR_19` sitting in the Northgate Rentals yard with no assignment.
- No idle `GEN_45KW` in the group. 4 projects (Riverside + 3 others) plan a `GEN_45KW` in
  the next 12 months.
- With these numbers, the #5 buy break-even month is **≤ 6** (aim for 5). If one of the
  other generator projects slips 6 weeks, it becomes **> 6** → the recommendation flips
  to rent outside. Tune the dates/rates until this holds.

## #5 Cost model (`backend/yardsense/`)
Files: `__init__.py`, `config.py`, `cost_model.py`, `api.py`; `backend/tests/test_cost_model.py`;
`backend/requirements.txt` (`fastapi`, `uvicorn`, `pytest`, `httpx`).

`config.py`: `load_rates(path=None)` reads `data/seed/rates.json` (path found relative
to the repo root; env `YARDSENSE_RATES` overrides).

`cost_model.py`: pure functions, no DB:
- `road_km(lat1, lon1, lat2, lon2, road_factor)` = haversine × road_factor
- `transport_cost(km, s)` = `truck_base_fee + km * truck_cost_per_km`
- `rental_price(days, card)`: cheapest mix of months (28 d), weeks (7 d), days, where a
  partial tier never costs more than the next tier up.
- `price_options(request, cls_rates, settings, idle_owned, idle_sister, pipeline)` → list
  of 4 option dicts:
  `{option, available, project_cost, group_cost, kept_in_group, reason, breakdown: [{label, amount}]}`
  - **move_ours** (idle unit owned by NB01/NE01, nearest one): project = internal rate for
    the duration + transport; group = transport + wear_per_day × days.
  - **rent_sister** (idle NR01 unit): project = internal rate + transport; group =
    transport + wear × days (the unit was idle anyway).
  - **rent_outside**: project = group = rental_price(outside) + outside_delivery_fee.
  - **buy** (Northgate Rentals buys): `pipeline` = list of `(start, finish)` needs for this
    class across all projects inside horizon_months. Month m cost to own =
    `price − resale(m) + (maint + ins) × m`, with `resale(m) = price × (1 − resale_pct_per_year)^(m/12)`.
    Month m savings = outside rental avoided for pipeline days that fall before the end of month m.
    `breakeven_month` = first m in 1..horizon where savings ≥ cost to own, else None.
    Available only if `breakeven_month <= max_breakeven_months`. group_cost = this request's
    share = cost_to_own(horizon) × request_days / pipeline_days. project = internal rate.
  - `kept_in_group` = rent_outside.group_cost − option.group_cost (0 for rent_outside).
  - Unavailable options are still returned with `available: false` and a reason.
- `rank(options)`: available first, then by group_cost ascending.
- Each `reason` is one plain sentence, e.g. "Telehandler idle at Westgate Tower since Nov 6; 14 km move."

`api.py`: `router = APIRouter()`. `POST /recommend` with optional body
`{project_id, items: [{class, qty, start, finish}]}`; no body → the hard-coded Riverside
request. For each item it returns ranked options. For #5, idle units come from the seed
JSON files directly (#4 swaps this for the DB). Anant's `main.py` will `include_router` it.

Tests (`pytest backend/tests`): build a FastAPI app in a fixture with `include_router`.
- telehandler → move_ours ranks first; 19' scissor lift → rent_sister ranks first;
  45 kW generator → buy ranks first, breakeven_month ≤ 6.
- After shifting one generator project's dates +42 days → buy unavailable, rent_outside first.
- rental_price tiers (e.g. 10 days is never more than 2 weeks).
- POST /recommend with no body returns 200 and 4 options per item.

## #4 Schema + connectors (`backend/yardsense/`)
Files: `schema.sql`, `db.py`, `connectors/__init__.py`, `connectors/base.py`,
`connectors/sap.py`, `connectors/procore.py`, `backend/scripts/reset_db.py`,
`backend/tests/test_db.py`; add routes to `api.py`.

- `schema.sql`: tables `companies`, `sites`, `assets`, `projects`, `phases`, `needs`,
  `rates`, `assignments`. Simple columns, foreign keys, internal snake_case names.
- `connectors/base.py`: `AssetSource.get_assets() -> list[dict]` and
  `ProjectSource.get_projects() -> list[dict]` (abstract base classes). Output uses
  internal field names (`asset_id, description, asset_class, company, acquired, cost`).
- `SAPConnector(path)` reads `sap_assets.json` and maps SAP field names → internal ones.
  `ProcoreConnector(path)` reads `procore_projects.json` → projects + phases + needs.
  The docstring says "swap for a real API client with the same methods".
- `db.py`: `get_conn()` (path from env `YARDSENSE_DB`, default `backend/yardsense.db`),
  `reset_db()` = drop all tables, run schema.sql, and load via the connectors plus
  companies/sites/rates/assignments JSON.
- `python backend/scripts/reset_db.py` = the one reset command.
- Routes: `GET /projects` (with nested phases and needs), `GET /assets`, `GET /sites`.
  Switch `POST /recommend` to read idle units/pipeline from the DB, and keep the #5 tests passing.
- Tests: use a temp DB, reset, check row counts > 0, and check the 3 GET routes return 200 with data.

## #6 Timeline (`frontend/src/components/`)
Files: `Timeline.jsx`, `Timeline.css`, `TimelineView.jsx`, `sampleProjects.js`.
- `Timeline({projects, allocations = []})`: plain divs/CSS grid, one row per project,
  a bar from start to completion, with phases as colored segments inside it and month labels
  across the top. Under each project, equipment rows from `planned_equipment`/needs
  (placeholder for allocator output, labeled "planned"). A vertical "today" line at
  demo_today.
- `TimelineView`: fetches `${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/projects`,
  falls back to `sampleProjects.js` (same shape as GET /projects) on error.
- Fits 1366px wide (no horizontal page scroll; the chart scales to the container width).
- No npm install is possible until Anant's Vite app exists. Keep it valid JSX and plain
  React hooks. Note in the commit message how to mount it: `<TimelineView />` in App.jsx.

## #7 Pitch v1 (`pitch/`, README)
- `pitch/story-script.md`: the "Monday 7:10 AM" story, 3 minutes (~400 words), spoken
  style, with stage cues (`[slide: ...]`). Built from plan.md's Story + Demo sentence.
- `pitch/competitors.md`: the slide table (Tenna, Procore Equipment, HCSS Dispatcher,
  rental ERPs like Wynne/Point of Rental vs YardSense), the one-liner, and a
  "if they already use Procore Equipment" line. Only claims that are in plan.md; mark
  anything unverified as "(to verify)".
- `README.md`: tighten the description, fill in the Team list (Gurshmeer Singh, Rakshit,
  Sreeman, Aarish, Anant; roles TBD), and leave the Run section for Anant.
