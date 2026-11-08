# Synthetic CSV exports

These files contain only fictional Northgate Group data. Use the **Data upload** tab to
download and import them. They demonstrate live changes to the SQLite plan:

- `sap_assets.csv` is the seeded SAP register plus asset `199999`, an unassigned
  group-owned generator. After import, Riverside's generator recommendation changes.
- `procore_schedule.csv` contains all five seeded projects, with Kingsway Lofts
  shifted six weeks later. Reimporting it replaces those projects' schedule rows
  instead of duplicating them.

The SAP columns are `ANLN1` (asset ID), `TXT50` (description), `ANLKL` (equipment
class), `BUKRS` (company code), `AKTIV` (acquisition date), and `ANSWL` (cost).

The Procore-style schedule is a flat export. Each row represents one schedule task
and, optionally, one equipment need attached to it. Repeat the task columns for
additional needs. Required columns are `project_id`, `project_number`, `project_name`,
`company`, `site_id`, `start_date`, `completion_date`, `task_name`, `task_start`,
`task_finish`, `asset_class`, `qty`, `need_start`, and `need_finish`. Leave all four
equipment-need columns empty for tasks without a need.

Dates use `YYYY-MM-DD`. Company, site, and equipment class codes must already exist
in the local database. Imports update matching IDs and add new IDs; they do not
remove other records. Run `python backend/scripts/reset_db.py` from the repo root
to restore the original synthetic demo state.
