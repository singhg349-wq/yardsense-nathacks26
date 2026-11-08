# Seed data: the fictional Northgate Group

Everything here is made up. Company names, addresses, asset numbers and most rates are
placeholders, and `rates.json` is marked `"placeholder": true`. The 4-week outside rates
for the 19 ft scissor lift and the telehandler are sourced from public listings; the rest
are tuning values. `sources.json` records which is which, with confidence and citations.
The demo "today" is **2026-11-16** (`settings.demo_today` in `rates.json`).

| File | What it is | Source-system shape |
|---|---|---|
| `companies.json` | 3 companies: NB01 Northgate Builders (gc), NR01 Northgate Rentals (rental), NE01 Northgate Electric (trade) | our own |
| `sites.json` | 2 yards, 5 project sites, 2 rental-customer sites, with Edmonton-area coordinates | our own |
| `sap_assets.json` | 53 assets: asset number, text, class, owning company, capitalization date, acquisition value | SAP asset register (`ANLN1`, `TXT50`, `ANLKL`, `BUKRS`, `AKTIV`, `ANSWL`) |
| `procore_projects.json` | 5 projects with schedule tasks and planned equipment needs | Procore project schedule |
| `assignments.json` | Dana's check-out/in log: where each unit is now. `checked_in: null` means still out. | our app |
| `rates.json` | settings, outside and internal rate cards, purchase price, resale %, upkeep, wear, transport | rate cards |
| `road_distances.json` | Directed driving distances between all 9 seed locations, precomputed 2026-11-07 | [OSRM Table service](https://project-osrm.org/docs/v5.24.0/api/#table-service) using OpenStreetMap roads |
| `backtest_history.json` | 96 synthetic past requests with decisions and availability flags, generated deterministically (seed 42) | generated |
| `sources.json` | provenance: each source, its mode, the rate rows, confidence levels, citations and assumptions | our own |

The saved road matrix is used for both move and sister-rental trucking. Unknown
site pairs fall back to straight-line distance × 1.3. No routing service is
called when the app runs. The site names and addresses are fictional; the
coordinates were routed on OpenStreetMap roads. Road data ©
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL),
routing by [OSRM](https://project-osrm.org/).

## What the data is built to show
- Westgate Tower's framing ended 2026-11-06, so its telehandler is idle.
- Two 19 ft scissor lifts sit unassigned in the Northgate Rentals yard.
- No 45 kW generator is idle anywhere. Four projects plan one in the next 12 months.
- Riverside Clinic asks for 2 scissor lifts, 1 telehandler and 1 generator for 10 weeks from 2026-11-23.

## Using real numbers
Put the raw files in `data/private/` (it is gitignored, never commit it), anonymize them,
and edit `rates.json` only. Everything else reads its prices from that one file.
Update `sources.json` in the same change so the app shows the new confidence and citations.
After editing any seed file, run `python backend/scripts/reset_db.py` from the repo root.
To regenerate the synthetic backtest history, run
`python backend/scripts/generate_backtest_history.py`.
