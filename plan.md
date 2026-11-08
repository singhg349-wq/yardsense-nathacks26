# plan.md: YardSense (working name)

natHacks 2026 · Construction & Manufacturing track · 80-pt rubric · 5-min presentation + demo, then 5-min Q&A · Fri Nov 6, 7 PM → submit Mon Nov 9, 9:30 AM

> **Privacy rule:** our target persona is a real company group (a real Edmonton GC group with its own rental company; name kept off the repo). Keep the real names, and every real number the industry helper supplies, **out of the public repo, demo and slides**. The demo uses the fictional **Northgate Group**. Real numbers live in `data/private/` (gitignored) and are used only to tune the mock data.

---

## Locked decisions
| Decision | Choice |
|---|---|
| Scope | Group-level equipment engine: **Move ours / Rent from sister / Rent outside / Buy**. No photo/CV, no trackers |
| Headline selling point | **Group-level brain**: optimize across the GC + sister rental company + trade companies at group cost. "Keep rental dollars inside the family." |
| Second selling point | **Zero hardware**: runs on the SAP, Procore and Textura data the group already has |
| Data sources (all mocked in their real shapes) | **SAP** asset register (what the group owns) · **Procore** project schedules (future demand) · **Textura** sub pay-app/change-order lines (rental leaks) · rate cards |
| "What's idle right now" | (a) Dana checks equipment out/in in our app + (c) inferred from schedules (a unit frees up when its project phase ends) |
| "Buy" means | **The sister rental company (Northgate Rentals) buys it**, then rents it to projects at the internal rate |
| Demo user | **Dana, the equipment coordinator** |
| Hero numbers | **$ kept inside the group** (headline) · **idle days on owned equipment** (supporting) |
| Stack | Python FastAPI + SQLite, React (Vite) |

## The fictional demo group: Northgate Group
- **Northgate Builders**: the GC (4–5 active and upcoming projects)
- **Northgate Rentals**: the group's equipment rental company (mirrors the real group's rental company)
- **Northgate Electric**: a trade company that also needs equipment

---

## User
**Dana, equipment coordinator at Northgate Builders.** Superintendents email or call her with equipment requests. Her tools today are an SAP asset register (it knows what's owned but not where it is or whether it's free), a stale "who has what" spreadsheet, and phone calls to the yard, to Northgate Rentals (the policy is to call them first), and to United Rentals. Decisions are made under time pressure, so external rental wins by default.

## Problem
Equipment decisions in a group of companies are made **project by project, by phone, under time pressure**, using an asset register that doesn't know what's free and schedules that nobody reads ahead. So rental dollars leave the group while the group's own equipment sits idle, and nobody adds up upcoming demand across projects to see when buying would be cheaper.

**The insight:** the cheapest option for one project isn't the cheapest option for the group. To a project, Northgate Rentals at $900/week and United at $950/week look about the same. To the group, the first one is money staying in the family on a unit that was idle anyway (its real cost is close to zero), and the second is $950 gone. Nobody's job today is to look at the group number.

**Security / resilience angle** (for Q&A, not the headline): read-only, least-privilege connectors to SAP, Procore and Textura; financial data anonymized and kept local; the check-out/in log creates an audit trail of where group assets are, so assets that go missing get noticed.

## Story (for the pitch)
Monday, 7:10 AM. Priya, the superintendent on *Riverside Clinic*, asks Dana for 2 scissor lifts, a telehandler and a 45 kW generator for 10 weeks. Dana spends 45 minutes on SAP, a spreadsheet and the phone, then books everything from United Rentals. Meanwhile:
- the group's telehandler has been idle at *Westgate Tower* since framing finished
- Northgate Rentals has 2 lifts idle in its yard
- four upcoming projects in Procore each plan to rent a 45 kW generator

At month-end, Riverside's equipment line is $14k over budget, and a drywall sub's change order in Textura bills $4,800 for lift rental during the same weeks the group's lifts sat idle. Money left the group three times, and nobody did anything wrong. Nobody could see the whole picture.

## Demo sentence
> **In the demo, Dana enters Priya's request for *Riverside Clinic*. YardSense recommends moving the idle telehandler from *Westgate Tower* on Tuesday, booking 2 lifts from Northgate Rentals, and having Northgate Rentals buy a 45 kW generator, because 4 pipeline projects need it and it breaks even in month 5. The "$ kept in group" counter jumps. Then Dana drags one project 6 weeks later on the timeline as a what-if, and the generator recommendation flips live to "rent outside short-term." Finally, the backtest shows last year's outside rentals and what the engine would have avoided.**

## How we're different
| | Tenna | Procore Equipment | **YardSense** |
|---|---|---|---|
| Needs trackers/telematics | Yes | Optional (telematics GA Jan 2026) | **No.** It reads data the group already has |
| Looks at | Past usage | Current project usage | **Future demand from schedules**, re-planned when schedules move |
| Scope | One company's fleet | One company, project by project | **Whole group**: GC + rental sister + trades |
| Optimizes for | Utilization | Project cost | **Group cost** (fixes the project-vs-group mismatch) |
| Sub-billed rentals | No | No | **Yes, through Textura** (pending confirmation) |
| SAP | No SAP integration found (COINS, Sage) | Its own platform | **Reads SAP** |
| Owner | John Deere | Procore | Neutral |

**One-liner:** *"Tenna and Procore tell you how your equipment **was** used. YardSense tells your **whole group of companies** what to move, rent or buy **next**, with no trackers, using the SAP and Procore data you already have."*

If the company already uses Procore's Equipment tool (still unknown), position YardSense as the **group-level planning layer on top of it**, not a replacement.

## Must / Should / Won't

**Must** (only what the demo sentence needs)
1. **Seed dataset:** the Northgate Group: 3 companies, 4–5 projects with phases and dates, ~40–60 mid/heavy items (scissor and boom lifts, telehandlers, generators, heaters, light towers, compactors, small excavators), Edmonton-realistic day/week/month rental rates, Northgate Rentals' internal rate card, purchase price, resale %, maintenance + insurance per month, transport cost between sites.
2. **Connectors (mock, swappable interface):**
   - `SAPConnector`: asset register (ID, description, class, owning company, acquisition cost, date)
   - `ProcoreConnector`: projects, phases, dates, planned equipment needs
3. **Availability:** a check-out/in log (Dana records which unit is on which project) + schedule inference (a unit becomes free when its project phase ends).
4. **Cost model, two lenses.** For each of the 4 options, calculate both:
   - *Project cost*: what the project is charged
   - *Group cost*: what actually leaves the group (internal rental = marginal cost: transport + wear; outside rental = full rate; buy = price − resale + carrying costs, spread across every pipeline project that needs the item → break-even month)

   Recommend on group cost and show both.
5. **Min-cost group allocator** (the technical core): a min-cost flow or MILP (OR-Tools or PuLP) that assigns owned and Northgate Rentals units to every request across the timeline at group cost, with transport included. It re-runs whenever a date changes. **The greedy allocator is built first and kept as the fallback.**
6. **Real transport cost:** yards and sites geocoded (Edmonton-area fictional addresses). Road distance is precomputed (OSRM, or straight-line distance × 1.3 as a fallback) and converted to a truck cost per move. "Move ours" uses it, and it's shown on a map with routes.
7. **Backtest:** 12 months of synthetic *past* requests and what was actually done (rented outside, bought, moved). Replay them through the engine to get the headline number: *"$X left the group last year; YardSense would have kept $Y."*
8. **Live file upload:** upload a CSV in SAP asset-register format and a Procore schedule export format. The app validates and ingests it live, and the recommendations update. This proves the connectors are real code, not hard-coded data.
9. **Fleet advisor (Northgate Rentals view):** from the GC's 12-month pipeline, the shipped rule-based advisor returns: *"Add 2 × 60 ft boom lifts and 2 × 400k BTU heaters; retire one plate compactor and one mini excavator (13.7% utilized)."* The rules are shown in the app. (The earlier 45 kW generator / telehandler example did not match the seed's fleet counts.)
10. **Screens:** (a) request → ranked options with $, a one-line reason and a "Why this?" breakdown; (b) group timeline where dragging a project runs a what-if re-plan (it does not edit the schedule of record); (c) map with recommended moves; (d) dashboard with **$ kept in group**, **idle days** and the synthetic backtest result; (e) fleet advisor; (f) data upload + provenance.

**Should**
- A "Why this?" cost waterfall per option (answers "show me the formula"). Cheap, and it helps Rigor and Delivery. **Do this first among the Shoulds.**
- `TexturaConnector` + **rental leak report**. Depends on confirming how subs bill (see open items).
- Utilization heatmap per asset over the next 12 weeks.
- Export the recommendation as a transfer note or PO.

**Dropped (decided)**
- Monte Carlo buy decisions
- Text-message / LLM intake
- Customer interviews (no access by Saturday; we rely on the industry helper's experience plus public evidence)

**Won't (this weekend)**
- Real SAP/Procore/Textura API connections (the swappable connector is the continuation story)
- Trackers, GPS, photo/CV
- Auth, multi-tenant, mobile
- Full budget forecasting

## Riskiest assumption
**"Our group-cost numbers match what a real coordinator would do, and the answer isn't obvious."**
- **Spike (tonight, first 2 hours):** Gurshmeer and the data lane run 3 items with the helper's numbers (telehandler, 45 kW generator, 19' scissor lift) through all 4 options in a spreadsheet, under 2 pipelines (normal and one project slipped 6 weeks). Success: the recommendation flips between the pipelines, and the helper agrees with both answers.
- **Fallback:** a transparent rule-based version (idle internal unit → move; Northgate Rentals has a unit → sister; pipeline demand over the break-even point → rental company buys; else rent outside), with every assumption editable in the UI.
- **Second risk, the allocator:** greedy ships first (by the Sat 6 PM MVP gate). Min-cost is built on top and swapped in only if it matches or beats greedy on the backtest by **Sun 2 PM**. Otherwise greedy stays, and the flip still works. **Result (Nov 8):** the PuLP/CBC static comparison solves the 16-request snapshot in ~34 ms; min-cost is **2.2% ($2,825) below a like-for-like greedy**. The live plan stays greedy because the static model does not re-price relocation and only allows buy when no unit is free; the comparison is shown on the Dashboard.
- **Third risk, workload:** this is 5 engine/data features plus 5 screens. Order of build: greedy → transport cost → backtest → upload → fleet advisor → min-cost. Anything not working by **Sun 10 PM code freeze** gets cut from the demo, not patched live.

## Task split
**Team (5, all CS):** Gurshmeer, Rakshit, Sreeman, Aarish, Anant. **Industry helper (not a teammate):** someone with construction-company experience who answers questions and checks numbers. Their input is tracked with the `needs:helper` label.

Work is tracked as user-story issues on GitHub, with one milestone per gate. Lanes are picked in the pinned issue #1. Suggested lanes:

| Lane | Owns | Milestone-1 issues (due Sat 10 AM) |
|---|---|---|
| **Engine lead** (suggested: Gurshmeer) | Cost model, greedy → min-cost allocator, backtest runner | #5 cost model |
| **Engine/geo + data** | Seed data, backtest history, road distances, transport cost; works with the helper | #3 seed dataset |
| **Backend** | FastAPI, SQLite, SAP/Procore connectors, CSV upload, availability log | #2 skeleton, #4 schema + connectors |
| **Frontend** | Timeline, request screen, drag-to-replan, map, dashboard | #6 timeline |
| **Frontend + pitch owner** | Fleet advisor UI, "Why this?" view; owns the deck, video and written summary from Sun afternoon | #7 pitch v1 |

## Rubric map (80)
| Criterion | Pts | Target | What earns it |
|---|---|---|---|
| Technical Rigor | 10 | 8 | Min-cost allocator (greedy fallback), road-distance transport cost, backtest that proves the engine against a baseline, two-lens cost model |
| Functionality | 10 | 8 | Live CSV upload in SAP/Procore format → recommendations update; request → answer → timeline → map → dashboard → fleet advisor all live |
| Creativity | 10 | 7 | The project-vs-group cost insight; the live schedule-slip flip; the map with routes; the fleet advisor for the rental arm |
| Innovation | 10 | 6 | Group-level optimization at group cost, driven by the future pipeline, no hardware; the fleet advisor. Name Procore, HCSS and Tenna ourselves and show the gap |
| Commercial Viability | 5 | 3 | Buyer type with public proof (Turner's First Equipment Company, real Edmonton GC groups that own a rental company); reads systems they already pay for; pricing slide. **No customer interviews**, so it's capped here |
| Delivery | 5 | 4 | Story → live demo → engine → competitors; 3+ rehearsals; recorded backup video |
| Impact | 5 | 4 | **Backtest result:** "$Y of $X would have stayed in the group last year" + idle days; Alberta context ($29B sector, 8.3% of GDP) |
| Written Summary | 5 | 4 | Drafted Sunday from this plan |
| Interdisciplinary Team | 5 | **0** | All-CS team (decided). The industry helper's input still strengthens Delivery and Commercial |
| **Total** | **80** | **~44** | The engine and demo upgrades add about +6; the all-CS team costs about −4 to −5 compared with the earlier estimate |

## Presentation (5 min + 5 min Q&A)
Confirmed with the organizers' handbook (see `DECISIONS.md` #11). The demo shows only the main flow; everything else goes to Q&A.

| Segment | Time | Who |
|---|---|---|
| Story: "Monday 7:10 AM" (Dana, Priya, money leaving the group) | 0:45 | Pitch owner |
| Live demo: request → four options ranked by group cost → $ kept → slip a project 6 weeks → generator flips | 2:30 | Gurshmeer drives, pitch owner narrates |
| Why it works: group cost vs project cost, **backtest result** | 0:45 | Gurshmeer |
| Competitors (Procore, HCSS, Tenna) + one scale slide (connectors → shared tables → more engines) | 0:45 | Presenter |
| Close | 0:15 | Presenter |

Backup for Q&A, not the main talk: CSV upload, map, fleet advisor, "Why this?" breakdown, continuation plan.

## Hardware request list
**None.** This is software only. Backup: run everything on one laptop on `localhost`, plus a recorded demo video, in case Wi-Fi fails.

---

## First steps: tonight
1. **Now:** create the team GitHub repo, then run `/repo-init` (folders, `.gitignore` with `data/private/` and `.env`, issues from this plan).
2. **Next 2 hours:** the cost-model spike (Gurshmeer + data lane, using the helper's numbers): 3 items × 4 options × 2 pipelines, both cost lenses.
3. **In parallel:** the backend dev writes the schema and mock connectors; the web dev builds the React scaffold and timeline; the presenter writes the README and competitor slide.
4. **Before bed:** the industry helper sends close-to-real rates (outside rental, internal rental, purchase, resale, transport). Gurshmeer anonymizes them into `data/seed/`.
5. Run `/decision-log` to record: group-level selling point, no hardware, the rental company buys, availability = log + schedule, Northgate fictional group.

## Open items
- [ ] Does the company use **Procore's Equipment tool**, or only schedules? (This changes positioning to "a layer on top.")
- [ ] Do subs bill equipment as **separate lines in Textura** (change orders / T&M), or is it buried in "% complete"? If buried, Textura drops to a bonus feature.
- [ ] Is "call our rental company first" a real policy? (Assumed yes for now.)
- [ ] Northgate Rentals' internal rate vs market rate (a discount %).
- [ ] Is the SAP asset register really just a register? (Assumed yes.)
- [x] Team fields: all CS. Interdisciplinary scored as 0 (decided).
- [ ] Rough real numbers for the backtest: how many outside rentals per year and typical durations (the helper's best estimate is fine).
