# CLAUDE.md: house rules for YardSense

Read this before working in the repo. It applies to humans and AI assistants alike. Decisions and their reasons live in `DECISIONS.md`; the full plan is in `plan.md`.

## What we're building

A group-level equipment engine for the fictional **Northgate Group** (GC Northgate Builders, rental company Northgate Rentals, trade company Northgate Electric). For each equipment request it recommends **Move ours / Rent from sister / Rent outside / Buy** and ranks options by **group cost** (what actually leaves the group), while also showing project cost. Demo user: **Dana, equipment coordinator**.

**Build the main slice first:** seed data → greedy recommendation with both cost lenses → request screen → drag a project on the timeline → recommendation flips. No optional feature work until that works end to end (gate: Sat 6 PM).

## Stack and versions

- Backend: **Python 3.12**, FastAPI, Pydantic. Run with `uvicorn app.main:app --reload` from `backend/`.
- Frontend: **React + Vite**, **Node 24**.
- Storage: SQLite, automatically seeded from `data/seed/` on the first data request. Use `python backend/scripts/reset_db.py` from the repo root to restore the demo state.
- No Docker for development. Native installs on Windows and macOS.

## Rules

1. **Pin versions.** Backend: add `package==version` to `backend/requirements.txt` by hand (no `pip freeze` dumps; they break Windows). Frontend: commit `package-lock.json`.
2. **Same versions for everyone:** Python 3.12 (`.python-version`), Node 24 (`.nvmrc`).
3. **Paths:** always `pathlib.Path`. Never hard-code `/` or `\` in file paths.
4. **Virtual environments:** everyone uses a venv inside `backend/` (default name `.venv`; any other name must be added to `.gitignore`). Never `pip install` globally.
5. **README stays true.** If you change how to install or run anything, update the README's Run section in the same PR, and test it on Windows *and* macOS.
6. **Privacy.** The target persona is a real company group. Its real names and real numbers never go in the repo, demo, slides or commit messages. Real numbers live only in `data/private/` (gitignored). The demo uses Northgate Group only.
7. **No pre-event code.** Everything in this repo is written during the 64-hour competition (Nov 6, 7 PM – Nov 9, 11 AM MT).
8. **Secrets** go in `.env` files (gitignored). Commit `.env.example` with placeholder values.

## Working together

- Work comes from GitHub issues (user stories), one milestone per gate. Lanes are in issue #1.
- Branch per issue (`<issue#>-short-name`), small PRs into `main`, someone else glances at it before merging. Keep `main` runnable.
- **`main` is protected** (ruleset "Protect main"): no direct pushes, every change goes through a PR with **1 approval from someone else** and **all 4 CI checks passing** (Backend and Frontend on Windows and macOS). Force-pushing or deleting `main` is blocked. Only the repo admin can bypass, for emergencies.
- Start every branch from the latest `main` (`git fetch origin && git checkout -b <branch> origin/main`). A branch cut from an older `main` can drag old commits into its PR.
- Agree on API shapes (Pydantic models) before building both sides; change them only with a heads-up in Discord.
- Record any decision that changes scope, stack or data in `DECISIONS.md`.

## Deadlines

- **Sat 6 PM:** main slice works end to end.
- **Sun 2 PM:** min-cost allocator go/no-go (greedy stays otherwise).
- **Sun 10 PM:** code freeze. Anything broken is cut from the demo, not patched live.
- **Mon 9:30 AM:** our internal submission deadline (official: 11:00 AM MT, no late submissions).
- **Pitch:** 5-minute presentation + demo, then 5-minute Q&A.
