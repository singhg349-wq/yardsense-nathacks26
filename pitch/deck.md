# YardSense — 5-minute deck outline

**Format:** 5 minutes presentation + 5 minutes Q&A. The deck is a support act; the demo is the proof.
**Rule:** every number on a slide is either sourced, an assumption, or labelled synthetic.

---

## Slide 1 — Title

**YardSense**
*The group-level equipment decision engine.*
Northgate Group demo · natHacks 2026 · Construction & Manufacturing

Speaker line: "Tenna and Procore tell you how your equipment was used. We tell your whole group what to move, rent or buy next — with no trackers."

---

## Slide 2 — Monday, 7:10 AM

- Priya, superintendent on Riverside Clinic: 2 scissor lifts, 1 telehandler, 1 × 45 kW generator, 10 weeks.
- Dana, equipment coordinator: SAP asset register, a stale spreadsheet, a phone.
- 45 minutes later, everything is booked from an outside rental company.
- At month-end, Riverside's equipment line is $14k over budget.

Speaker line: "That's not a mistake. That's what you do at 7:55 on a Monday with a site waiting."

---

## Slide 3 — What Dana couldn't see

1. The group's telehandler has been idle at Westgate Tower since framing finished.
2. Northgate Rentals has two lifts parked in its yard.
3. Four upcoming projects each plan to rent a 45 kW generator.

Speaker line: "Money left the group three times, and nobody did anything wrong."

---

## Slide 4 — The insight

| | Project view | Group view |
|---|---|---|
| Rent from sister at $900/wk | A cost | Transport + wear; the unit was idle anyway |
| Rent outside at $950/wk | A slightly higher cost | $950 leaves the group |

**The cheapest option for a project is not the cheapest option for the group. Nobody's job today is to look at the group number.**

---

## Slide 5 — The product

For every request, rank four options by **group cost**:

1. **Move ours** — idle group unit
2. **Rent from sister** — idle Northgate Rentals unit
3. **Rent outside**
4. **Buy** — Northgate Rentals buys and rents internally

**No hardware.** Reads the SAP asset register, Procore schedules and the check-out log the group already has.
Every option shows **project cost** next to **group cost**, a reason, and a "Why this?" breakdown.

---

## Slide 6 — Live demo

Cue the app. The demo path:

1. Requests → Riverside Clinic → ranked options → "Why this?" → accept.
2. Timeline → plan snapshot → drag Kingsway six weeks as a what-if.
3. Map → recommended moves, distances, truck cost.
4. Dashboard → accepted savings, idle days, backtest.
5. Fleet advisor → add boom lifts and heaters; retire a mini excavator and compactor.
6. Data upload → load the slipped Procore schedule → generator flips buy → rent outside.

Speaker line: "The drag is a what-if. It does not edit the Procore schedule. The real change is the schedule import."

---

## Slide 7 — How it works

```
SAP asset register ─┐
Procore schedules ──┼─► connectors ─► SQLite ─► engine ─► FastAPI ─► React
Check-out log ──────┤                   │
Rate card / roads ──┘                   ├─ availability
                                        ├─ two-lens cost model
                                        ├─ greedy allocator
                                        ├─ backtest
                                        └─ fleet advisor
```

- **Availability:** check-out log + schedule inference (a unit frees when its phase ends).
- **Cost:** internal vs outside, transport, wear, buy break-even across the pipeline.
- **Plan:** greedy allocator with physical-unit reservations; re-runs on a what-if or a schedule import.
- **Exact check:** PuLP/CBC solves the same static snapshot; min-cost is 2.2% below greedy ($2,825). The live plan stays greedy because the exact model is static.
- **Explainability:** every number has a breakdown; every data source has a confidence label.

---

## Slide 8 — Impact: the synthetic backtest

**$137,859 of $275,391 outside spend avoided — 50.1% — across 96 synthetic requests, with 35 rental leaks.**

- 12-month replay, deterministic, seed 42.
- Buy excluded: historical pipeline demand is unknown.
- It is a **replay**, not a customer result. The dashboard says so.
- Public analogs: Caltrans found 9 of 32 owned units available while renting; NC DOT found 67% of heavy equipment used less than half the time.

Speaker line: "The point is not the exact number. The point is that the leak is measurable, and the engine can replay it."

---

## Slide 9 — Fleet advisor

From the 12-month pipeline, for the rental company:

- **Add 2 × 60 ft boom lifts** (peak demand 5 vs 3 owned)
- **Add 2 × 400k BTU heaters** (peak 6 vs 4 owned)
- **Retire one mini excavator and one plate compactor** (13.7% utilization)
- The rest: hold.

Every call shows the rule, utilization, break-even and annual impact.

---

## Slide 10 — Why us

| | Tenna | Procore Equipment | HCSS / rental ERPs | **YardSense** |
|---|---|---|---|---|
| Needs trackers | Yes | Optional | — | **No** |
| Looks at | Past usage | Current project usage | Dispatch/billing | **Future demand across the group** |
| Scope | One fleet | One company, project by project | One company/rental arm | **GC + sister rental + trades** |
| Optimizes | Utilization | Project cost | Operations | **Group cost** |

One-liner: *"Tenna and Procore tell you how your equipment was used. YardSense tells your whole group what to move, rent or buy next, using the data you already have."*

If they use Procore Equipment: we are the group-level planning layer on top, not a replacement.

---

## Slide 11 — Business

- **Buyer:** a general-contractor group with its own rental company.
- **Proof the structure exists:** Turner launched First Equipment Company in January 2026.
- **Why now:** groups already pay for SAP, Procore and a rental arm; the data exists, the decision layer does not.
- **Model:** per-group SaaS, or a per-project pilot fee. Not finalized.
- **Honest limit:** no customer interviews yet; commercial evidence is capped.

---

## Slide 12 — Roadmap + team + close

- **Next:** 60-day pilot on one group's real SAP/Procore export, read-only; compare recommendations to actual decisions.
- **Then:** Textura leak report, a dynamic optimizer if the static gap justifies it, more data sources on the same tables.
- **Team:** five CS students; industry guidance from a construction professional (not a team member). We accept the interdisciplinary rubric hit.
- **Close:** "The cheapest option for one project isn't the cheapest for the group. We built the engine that looks at the group."

---

## Rubric map (quick)

| Criterion | Where it shows |
|---|---|
| Technical Rigor | Two cost lenses, availability, transport matrix, greedy allocator, backtest, tests |
| Functionality | Six live screens, CSV upload, what-if flip, provenance |
| Creativity | Project-vs-group insight, live schedule flip, fleet advisor |
| Innovation | Group-level future demand, no hardware, SAP/Procore data |
| Commercial Viability | Buyer structure, Turner proof, pricing direction |
| Delivery | Story → demo → engine → competitors → close |
| Impact | Backtest number, idle days, public analogs |
| Written Summary | Separate submission doc |
| Interdisciplinary Team | Accepted 0 (all-CS) |
