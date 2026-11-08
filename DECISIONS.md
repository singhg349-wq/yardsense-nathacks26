# Decisions log

Newest at the bottom. Each entry: what we decided and why. Change a decision by adding a new entry, not by editing an old one.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | Nov 6 | **Group-level engine** (Move ours / Rent from sister / Rent outside / Buy), recommended on **group cost**, project cost shown alongside | The cheapest option for a project isn't the cheapest for the group; that gap is our core insight |
| 2 | Nov 6 | **No hardware:** no trackers, GPS or photo/CV. Reads SAP asset register + Procore schedules (mocked in their real shapes) | Zero-install pitch; groups already pay for these systems |
| 3 | Nov 6 | **"Buy" means the sister rental company (Northgate Rentals) buys**, then rents internally | Matches how real GC groups with a rental arm operate |
| 4 | Nov 6 | **Availability = check-out/in log + schedule inference** (a unit frees up when its project phase ends) | No trackers; schedules already hold the information |
| 5 | Nov 6 | **Fictional Northgate Group** in repo, demo and slides; real names/numbers only in gitignored `data/private/` | The target persona is a real company group; keep it private |
| 6 | Nov 6 | **Stack:** Python 3.13 + FastAPI backend; React + Vite frontend on Node 24 LTS | Python fits the engine (pandas, OR-Tools/PuLP); Vite + React has good draggable-timeline libraries |
| 7 | Nov 6 | **In-memory storage** loaded from `data/seed/`; SQLite only if we need data to survive restarts | Clean, repeatable demo state; no DB setup |
| 8 | Nov 6 | **No Docker for development.** Pin versions, venvs, pathlib, tested README instead. Optional docker-compose at the end | Docker Desktop/WSL2 setup and slow hot reload cost more than they save in 64 h |
| 9 | Nov 6 | **Main slice first** (seed → greedy recommendation → request screen → drag-to-replan flip); optional features only after it works (gate Sat 6 PM) | 10 Musts is too much; a polished slice scores better than many half-features |
| 10 | Nov 6 | **Greedy allocator first**; min-cost (OR-Tools/PuLP) swapped in only if it matches or beats greedy on the backtest by Sun 2 PM | De-risks the technical core |
| 11 | Nov 6 | **Pitch is 5 min + 5 min Q&A.** Demo shows only the main flow | Confirmed with organizers' handbook |
| 12 | Nov 6 | **All-CS team**; interdisciplinary bonus scored 0 of 3 | Decided at team formation |
| 13 | Nov 6 | **Internal submission deadline Mon 9:30 AM** (official 11:00 AM MT) | Buffer; late submissions aren't accepted |
| 14 | Nov 7 | **Switched to Python 3.12** (replaces the Python version in #6) | Matches what the team already has installed; no one has to install a new Python mid-hackathon. All our libraries support 3.12 |
| 15 | Nov 7 | **SQLite from seeded JSON** (replaces the in-memory storage in #7) | The schema and mock SAP/Procore connectors in issue #4 now load a local database that the assignment log can update |
| 16 | Nov 7 | **Map tab uses Leaflet with CARTO dark tiles when `VITE_CARTO_KEY` is set and darkened OSM tiles otherwise, plus a new read-only `GET /assignments`; frontend tests use Vitest.** Known gap to revisit: idle units on the map don't react to Timeline drags, because `/assets/available` takes no shifts | Fleet status and working counts need the check-out log, which no endpoint exposed. CARTO now watermarks tiles requested without a key. Tiles need internet; the map still works without them, on a plain dark background (see issue #21) |
| 17 | Nov 7 | **CSV uploads use raw `text/csv` bodies and update matching SAP assets or Procore projects in SQLite.** Procore task and need rows for imported projects are replaced together; other records remain. Both sample files are synthetic. | Avoids adding a multipart dependency, preserves assignment references, makes repeated imports safe, and lets the existing engine recalculate from the database. |
