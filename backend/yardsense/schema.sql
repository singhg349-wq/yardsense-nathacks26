-- YardSense tables. Internal snake_case names; dates are ISO text (YYYY-MM-DD).

CREATE TABLE companies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL            -- gc, rental or trade
);

CREATE TABLE sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,           -- yard or site
    company TEXT NOT NULL REFERENCES companies(code),
    address TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL
);

CREATE TABLE assets (
    asset_id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    asset_class TEXT NOT NULL,
    company TEXT NOT NULL REFERENCES companies(code),
    acquired TEXT,
    cost REAL
);

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    project_number TEXT,
    name TEXT NOT NULL,
    company TEXT NOT NULL REFERENCES companies(code),
    site_id TEXT NOT NULL REFERENCES sites(id),
    start_date TEXT NOT NULL,
    completion_date TEXT NOT NULL
);

CREATE TABLE phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    task_name TEXT NOT NULL,
    start TEXT NOT NULL,
    finish TEXT NOT NULL
);

CREATE TABLE needs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    asset_class TEXT NOT NULL,
    qty INTEGER NOT NULL,
    start TEXT NOT NULL,
    finish TEXT NOT NULL,
    phase TEXT
);

-- One row per equipment class: rate cards, purchase price and upkeep.
CREATE TABLE rates (
    asset_class TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    outside_day REAL, outside_week REAL, outside_month REAL,
    outside_delivery_fee REAL,
    internal_day REAL, internal_week REAL, internal_month REAL,
    purchase_price REAL,
    resale_pct_per_year REAL,
    maintenance_month REAL,
    insurance_month REAL,
    wear_per_day REAL
);

-- Global settings (demo_today, road_factor, ...). Values are JSON text.
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Dana's check-out/in log. checked_in NULL means the unit is still out.
CREATE TABLE assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT NOT NULL REFERENCES assets(asset_id),
    project_id TEXT REFERENCES projects(id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    checked_out TEXT NOT NULL,
    checked_in TEXT
);
