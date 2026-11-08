"""Validate the two documented, flat CSV export shapes before changing SQLite."""
import csv
import io
from datetime import date
from math import isfinite

SAP_COLUMNS = ("ANLN1", "TXT50", "ANLKL", "BUKRS", "AKTIV", "ANSWL")
PROCORE_COLUMNS = ("project_id", "project_number", "project_name", "company", "site_id",
                   "start_date", "completion_date", "task_name", "task_start", "task_finish",
                   "asset_class", "qty", "need_start", "need_finish")


def read_rows(content, columns):
    if not content or len(content) > 2_000_000:
        raise ValueError("Choose a non-empty CSV file under 2 MB.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("CSV must be UTF-8 encoded.") from error
    if "\x00" in text:
        raise ValueError("CSV contains invalid NUL characters.")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    headers = reader.fieldnames or []
    if len(headers) != len(set(headers)):
        raise ValueError("CSV has duplicate column names.")
    missing = [column for column in columns if column not in headers]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")
    rows = []
    for row in reader:
        line = reader.line_num
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f"Row {line}: column count does not match the header.")
        row = {key: value.strip() for key, value in row.items()}
        if any(row.values()):
            rows.append((line, row))
    if not rows:
        raise ValueError("CSV has no data rows.")
    return rows


def required(row, key, line):
    value = row[key]
    if not value:
        raise ValueError(f"Row {line}: {key} is required.")
    return value


def iso_date(value, key, line):
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"Row {line}: {key} must be YYYY-MM-DD.") from error
    if parsed.isoformat() != value:
        raise ValueError(f"Row {line}: {key} must be YYYY-MM-DD.")
    return parsed


def date_pair(row, start, finish, line):
    first = iso_date(required(row, start, line), start, line)
    last = iso_date(required(row, finish, line), finish, line)
    if last < first:
        raise ValueError(f"Row {line}: {finish} is before {start}.")


def parse_sap(content):
    assets = []
    seen = set()
    for line, row in read_rows(content, SAP_COLUMNS):
        asset_id = required(row, "ANLN1", line)
        if asset_id in seen:
            raise ValueError(f"Row {line}: duplicate asset ID {asset_id}.")
        seen.add(asset_id)
        if row["AKTIV"]:
            iso_date(row["AKTIV"], "AKTIV", line)
        cost = None
        if row["ANSWL"]:
            try:
                cost = float(row["ANSWL"])
            except ValueError as error:
                raise ValueError(f"Row {line}: ANSWL must be a non-negative number.") from error
            if not isfinite(cost) or cost < 0:
                raise ValueError(f"Row {line}: ANSWL must be a non-negative number.")
        assets.append({"asset_id": asset_id, "description": required(row, "TXT50", line),
                       "asset_class": required(row, "ANLKL", line),
                       "company": required(row, "BUKRS", line),
                       "acquired": row["AKTIV"] or None, "cost": cost, "line": line})
    return assets


def parse_procore(content):
    projects = {}
    for line, row in read_rows(content, PROCORE_COLUMNS):
        project_id = required(row, "project_id", line)
        metadata = {"id": project_id,
                    "project_number": required(row, "project_number", line),
                    "name": required(row, "project_name", line),
                    "company": required(row, "company", line),
                    "site_id": required(row, "site_id", line),
                    "start_date": required(row, "start_date", line),
                    "completion_date": required(row, "completion_date", line)}
        date_pair(row, "start_date", "completion_date", line)
        project = projects.setdefault(project_id, {**metadata, "phases": {}, "needs": [],
                                                   "need_keys": set(), "line": line})
        if any(project[key] != value for key, value in metadata.items()):
            raise ValueError(f"Row {line}: project {project_id} has conflicting details.")
        phase = required(row, "task_name", line)
        date_pair(row, "task_start", "task_finish", line)
        phase_dates = (row["task_start"], row["task_finish"])
        if phase in project["phases"] and project["phases"][phase] != phase_dates:
            raise ValueError(f"Row {line}: task {phase} has conflicting dates.")
        project["phases"][phase] = phase_dates
        need_fields = ("asset_class", "qty", "need_start", "need_finish")
        if any(row[key] for key in need_fields):
            for key in need_fields:
                required(row, key, line)
            date_pair(row, "need_start", "need_finish", line)
            try:
                qty = int(row["qty"])
            except ValueError as error:
                raise ValueError(f"Row {line}: qty must be a positive integer.") from error
            if qty < 1:
                raise ValueError(f"Row {line}: qty must be a positive integer.")
            need_key = (phase, row["asset_class"], qty, row["need_start"], row["need_finish"])
            if need_key in project["need_keys"]:
                raise ValueError(f"Row {line}: duplicate equipment need.")
            project["need_keys"].add(need_key)
            project["needs"].append({"asset_class": row["asset_class"], "qty": qty,
                                     "start": row["need_start"], "finish": row["need_finish"],
                                     "phase": phase, "line": line})
    return list(projects.values())
