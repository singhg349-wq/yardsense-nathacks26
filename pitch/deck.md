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
| Rent from sister at $792 / 4 wk (88% of outside, assumption) | A cost | Transport + wear; the unit was idle anyway |
| Rent outside at $900 / 4 wk (sourced scissor rate) | A slightly higher cost | $900 leaves the group |

**The cheapest option for a project is not the cheapest option for the group. Nobody's job today is to look at the group number.**

---

## Slide 5 — The product

For every request, rank four options by **group cost**:

1. **Move ours** — idle group unit
2. **Rent from sister** — idle Northgate Rentals unit
3. **Rent outside**
4. **Buy** — Northgate Rentals buys and rents internally

**No hardware.** Reads SAP asset-register and Procore schedule exports, plus a check-out log kept in the app.
Every option shows **project cost** next to **group cost**, a reason, and a "Why this?" breakdown.

---

## Slide 6 — Live demo

Cue the app. The demo path:

1. Requests → Riverside Clinic → ranked options → "Why this?" → accept (scissor → rent from sister; telehandler → move ours, 11 km, $198 truck; generator → rent outside; one more would net -$3,750 a year, so the engine does not buy).
2. Timeline → plan snapshot → drag Kingsway six weeks as a what-if (two recommendations change: Kingsway takes the two idle sister-yard lifts, so Riverside's and Capilano's scissors go to outside rental).
3. Map → recommended moves, distances, truck cost.
4. Dashboard → accepted savings, idle days, backtest, static optimizer comparison.
5. Fleet advisor → retire one idle mini excavator; hold everything else (no extra unit pays for itself).
6. Data upload → load the slipped Procore schedule → Riverside's scissors flip rent from sister → rent outside.

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
- **Exact check:** on a static snapshot of 16 requests, PuLP/CBC min-cost is $131,169 vs a greedy pass at $133,993 under the same model: $2,825 (2.1%) lower. It does not grade the live plan ($133,928, a richer model). The Timeline's re-plan card is suggestion-only; it locks started requests and charges a switching cost for any change.
- **Explainability:** every number has a breakdown; every data source has a confidence label.

---

## Slide 8 — Impact: the synthetic backtest

**$48,112 of $286,266 outside spend avoided — 16.8% — across 96 synthetic requests, with 15 rental leaks.**

- 12-month replay, deterministic, seeded. About 1 in 5 requests had an idle group or sister unit: that rate is our input, so the percentage shows the method, not a forecast.
- Buy excluded: historical pipeline demand is unknown.
- It is a **replay**, not a customer result. The dashboard says so.
- Public analogs: Caltrans found 9 of 32 owned units available while renting; NC DOT found 67% of heavy equipment used less than half the time.

Speaker line: "The availability rate is our input. The point is not the exact number; the leak is measurable, and the engine can replay it."

---

## Slide 9 — Fleet advisor

From the 12-month pipeline, for the rental company:

- **Retire one mini excavator** (idle today, surplus to peak demand): +$7,200 a year.
- **Hold** everything else. Each extra unit is priced on its own demand, net of a year's cost to own, and none pays: the next generator covers 308 days, $10,050 of rent avoided against $13,800 to own (-$3,750); the next boom lift covers 26 days, $3,950 against $21,240.

The fleet advisor and the live plan use the same unit economics, so they agree: the plan buys nothing.

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
- **Then:** Textura leak report, live re-solving (locks delivered units, switching cost per change), more data sources on the same tables.
- **Team:** five CS students; industry guidance from a construction professional (not a team member). We accept the interdisciplinary rubric hit.
- **Close:** "The cheapest option for one project isn't the cheapest for the group. We built the engine that looks at the group."

---

## Rubric map (quick)

| Criterion | Where it shows |
|---|---|
| Technical Rigor | Two cost lenses, availability, transport matrix, greedy allocator, static-snapshot exact solver (2.1% below greedy on 16 requests; not a grade of the live plan), backtest, 102 backend + 103 frontend tests |
| Functionality | Six live screens, CSV upload, what-if re-plan, provenance |
| Creativity | Project-vs-group insight, a slip that ripples across projects, an engine that refuses a bad buy |
| Innovation | Group-level future demand, no hardware, SAP/Procore data |
| Commercial Viability | Buyer structure, Turner proof, pricing direction |
| Delivery | Story → demo → engine → competitors → close |
| Impact | Backtest number, idle days, public analogs |
| Written Summary | Separate submission doc |
| Interdisciplinary Team | Accepted 0 (all-CS) |
