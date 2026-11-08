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
| 1 | Requests | Wait for the three Riverside items and ranked options | "Three needs, four options each, ranked by what the whole group pays." |
| 2 | Requests | Open **Why this?** on the telehandler; close it | "Internal rental plus transport. The project sees a charge; the group sees transport and wear." |
| 3 | Requests | Accept the scissor, telehandler and generator recommendations | "The kept-in-group counter rises with each accepted decision." |
| 4 | Timeline | Drag **Kingsway Lofts** six weeks right | "This is a what-if. The engine re-runs; the generator flips from buy to rent outside." |
| 5 | Map | Point at the telehandler move and the table | "Eleven kilometres, one hundred ninety-eight dollars; the saved road matrix, no live routing." |
| 6 | Dashboard | Point at accepted savings, idle days, backtest, optimizer | "A synthetic replay: one hundred thirty-seven thousand avoided; the optimizer is 2.2% below greedy." |
| 7 | Fleet advisor | Point at Add 2 boom lifts / Add 2 heaters / Retire 2 | "The rental arm sees what the next twelve months imply." |
| 8 | Data upload | Click **Load slipped schedule demo**; wait for "Imported 5 projects"; click **View requests** | "Same flip through the real-data path: Procore sent a revised schedule." |
| 9 | Requests | Point at generator **Rent outside** | "No one edited the schedule by hand. The engine re-ran." |

## Timing

- 0:00–1:00 story
- 1:00–1:20 insight
- 1:20–3:40 demo (steps 1–9)
- 3:40–4:15 engine + backtest + optimizer
- 4:15–4:45 competitors + business
- 4:45–5:00 close

## Recovery

| Failure | Recovery |
|---|---|
| Backend error / blank screen | Switch to the backup video; keep narrating the deck |
| CSV upload fails | Use the Timeline drag only; say the CSV path is in the repo and tested |
| Map tiles do not load | The map still shows markers and routes; do not mention tiles |
| Dashboard is slow | Skip step 6; go to Fleet advisor or the backtest slide |
| Running long | Skip Fleet advisor (step 7) and the provenance scroll; keep the flip |
| Judge asks for a number | Use the backtest headline, the fleet calls, or the min-cost gap; do not invent |

## Reset between rehearsals

```powershell
python backend/scripts/reset_db.py
```

Then reload the browser. The accepted recommendations and any imported CSV are cleared.
