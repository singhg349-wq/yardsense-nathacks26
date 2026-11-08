# Demo runbook — 5-minute pitch

**One driver, one narrator.** Do not debug live. If the app fails, switch to the backup video.

> **UI restyle (Sun Nov 8):** the app is being restyled today (navy + safety orange, cost bars on Requests, a legend on the Timeline). The click path below stays the same. Steps marked **[re-check UI]** quote on-screen labels or banner text; re-run the path after the redesign and update the wording if a label changed.

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
| 1 | Requests | Wait for the three Riverside items and ranked options (new cost bars) **[re-check UI]** | "Three needs, four options each, ranked by what the whole group pays." |
| 2 | Requests | Open **Why this?** on the telehandler; close it **[re-check UI: button label]** | "Internal rental plus transport. The project sees a charge; the group sees transport and wear." |
| 3 | Requests | Accept the scissor, telehandler and generator recommendations **[re-check UI: counter name]** | "The kept-in-group counter rises with each accepted decision. The generator buy breaks even in month five." |
| 4 | Timeline | Drag **Kingsway Lofts** six weeks right **[re-check UI: banner text "five changes", new legend]** | "This is a what-if. The engine re-runs; five recommendations change. The generator flips from buy to rent outside." |
| 5 | Map | Point at the telehandler move and the table | "Eleven kilometres, one hundred ninety-eight dollars; the saved road matrix, no live routing." |
| 6 | Dashboard | Point at accepted savings, idle days, backtest, optimizer | "A synthetic replay: ninety-six requests, thirty-five leaks, one hundred thirty-seven thousand avoided of two hundred seventy-five. The exact solver shows greedy is within 2.2%." |
| 7 | Fleet advisor | Point at Add 2 boom lifts / Add 2 heaters / Retire 2 **[re-check UI: card labels]** | "The rental arm sees what the next twelve months imply." |
| 8 | Data upload | Click **Load slipped schedule demo**; wait for "Imported 5 projects"; click **View requests** **[re-check UI: button + toast text]** | "Same flip through the real-data path: Procore sent a revised schedule." |
| 9 | Requests | Point at generator **Rent outside** **[re-check UI: option label]** | "No one edited the schedule by hand. The engine re-ran." |

## Timing

- 0:00–0:55 story
- 0:55–1:20 insight
- 1:20–3:40 demo (steps 1–9)
- 3:40–4:10 engine + exact-solver check + tests
- 4:10–4:40 competitors + business
- 4:40–5:00 close

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
