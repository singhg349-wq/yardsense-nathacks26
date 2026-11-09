# Demo runbook — 5-minute pitch

**One driver, one narrator.** Do not debug live. If the app fails, switch to the backup video.

## Pre-flight (15 minutes before)

1. `python backend/scripts/reset_db.py`
2. Start backend: `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload`
3. Start frontend: `cd frontend; npm run dev`
4. Open `http://localhost:5173`; zoom to 110%; hide bookmarks; close Discord/Slack/email.
5. Run the click path once, then reset the DB again.
6. Have `pitch/script-5min.md` open on a second screen and the backup video ready.

## Click path

| Step | Screen | Click | Say |
|---|---|---|---|
| 1 | Requests | Wait for the three Riverside items and ranked options (new cost bars) | "Three needs, four options each, ranked by what the whole group pays." |
| 2 | Requests | Open **Why this?** on the telehandler; close it | "Internal rental plus transport. The project sees a charge; the group sees transport and wear." |
| 3 | Requests | Accept the scissor, telehandler and generator recommendations | "The kept-in-group counter rises with each accepted decision. The generator is rented outside: one more would lose $3,750 a year, so the engine refuses to buy." |
| 4 | Timeline | Drag **Kingsway Lofts** six weeks right | "This is a what-if. The engine re-runs; two recommendations change. Kingsway's scissor phase now starts first and takes the two idle Northgate Rentals lifts, so Riverside's and one of Capilano's go to outside rental. The ones already accepted get flagged 'changed by what-if', so nothing changes silently." |
| 5 | Map | Point at the telehandler move and the table | "Ten point six kilometres, one hundred ninety-eight dollars of trucking, from the saved road matrix." |
| 6 | Dashboard | Point at accepted savings, idle days, backtest, optimizer | "A synthetic replay: ninety-six requests, fifteen leaks, forty-eight thousand avoided of two hundred eighty-six. The rates are our input: it shows the method, not a forecast. On a static snapshot of sixteen requests, the exact solver is 2.1% below greedy; that does not grade the live plan." |
| 7 | Fleet advisor | Point at Retire 1 mini excavator; every other class is Hold | "The rental arm sees what the next twelve months imply: retire one idle unit, add nothing. It agrees with the generator call." |
| 8 | Data upload | Click **Load slipped schedule demo**; wait for "Imported 5 projects"; click **View requests** | "Same change through the real-data path: Procore sent a revised schedule." |
| 9 | Requests | Point at the Riverside scissor lifts: **Rent outside** | "No one edited the schedule by hand. The engine re-ran." |

## Timing

- 0:00–0:55 story
- 0:55–1:20 insight
- 1:20–3:40 demo (steps 1–9)
- 3:40–4:10 engine + static exact-solver check + tests
- 4:10–4:40 competitors + business
- 4:40–5:00 close

## Recovery

| Failure | Recovery |
|---|---|
| Backend error / blank screen | Switch to the backup video; keep narrating the deck |
| CSV upload fails | Use the Timeline drag only; say the CSV path is in the repo and tested |
| Map tiles do not load | The map still shows markers and routes; do not mention tiles |
| Dashboard is slow | Skip step 6; go to Fleet advisor or the backtest slide |
| Running long | Skip Fleet advisor (step 7) and the provenance scroll; keep the Kingsway change |
| Judge asks for a number | Use the backtest headline, the fleet calls, or the static min-cost gap; do not invent |

## Reset between rehearsals

```powershell
python backend/scripts/reset_db.py
```

Then reload the browser. The accepted recommendations and any imported CSV are cleared.
