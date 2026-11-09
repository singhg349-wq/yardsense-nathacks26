# Judge Q&A — 12 hard questions, tight answers

**Rule:** answer in 20–40 seconds. Concede the true part, then give the specific defence.

---

### 1. "Isn't this a textbook assignment problem?"

The optimization is familiar; the product is not the solver. The hard part is the data model and the decision context: what is actually free, what the group pays versus what the project pays, how future demand changes a buy decision, and how to explain the answer to a project manager. We ship a greedy allocator that is easy to follow. On a static snapshot of the 16 upcoming requests, an exact PuLP/CBC solver is 2.1% ($2,825) cheaper than a greedy pass under the same model. The live plan uses a richer model, so it is not graded by that number. (see Q11). A textbook assignment problem does not have a check-out log, a sister rental company, or a schedule that moves.

### 2. "Procore already has equipment tracking. Why would anyone need this?"

Procore Equipment records owned, rented and managed equipment, connects to telematics, and forecasts what a project needs and when it is available. We rank move, rent from sister, rent outside and buy by group cost across the GC, the sister rental company and the trades. If the group already uses Procore Equipment, we sit on top as the group-level planning layer, not as a replacement. We are not claiming Procore cannot track equipment. In our public-web review we found no product that publicly ranks all four options by group cost across several legal entities from future schedules, and we have not tested these products hands-on.

### 3. "The data is fake. Why should we trust the numbers?"

You should not treat them as a customer result. The data is synthetic, and we say so in the app, the README and the pitch. What is real is the engine: it prices four options, reserves physical units, re-runs the plan on a what-if or a schedule import and replays a year of decisions; the backtest's availability rates are our inputs, so it shows the method, not a forecast. The provenance page labels every number as sourced, derived, placeholder or synthetic. The two 4-week market rates are sourced; the rest are labelled placeholder or derived. The next step is a pilot with the group's real SAP and Procore export.

### 4. "How do you know what's idle without trackers?"

Two signals: Dana's check-out and check-in log (kept in the app), and schedule inference. If a unit is checked out to a project and has not been checked in, it is busy. If it has not been checked in, the project's last planned need for that class tells us when the work ends, so the unit is released then. We are not claiming GPS. We know which project the unit went to and when its work should end, and the log creates an audit trail.

### 5. "What if the internal unit isn't a true match — wrong attachment, poor condition, no operator?"

Then it should not be offered, and the economics should say so. The engine matches on equipment class and availability; a production version adds suitability rules — attachments, condition, certifications, operator — as constraints. If the internal unit is not a true match, outside rental wins, and the tool should show that. Our current demo only offers a unit when the class and dates match; it has no suitability checks yet.

### 6. "Why would the sister rental company cooperate? Doesn't internal rental cannibalize its outside revenue?"

The group owns both companies, so the group keeps the margin either way; the internal rate is still revenue to the rental arm. The real question is opportunity cost: if the unit could be rented to an outside customer at full rate, the group cost is not just transport and wear. Our current demo assumes the unit is idle, which is the optimistic case for internal use. The roadmap adds an opportunity-cost term when the rental arm has outside demand. That is also a good reason to run the pilot: it tells us how often the unit would otherwise be rented.

### 7. "Who pays for this, and how much?"

The buyer is the group, not the individual project. The value is outside rental avoided and better fleet decisions across the group. We propose $1,500 a month per group, with a 3-month pilot minimum. No customer has validated that price and we have not run customer interviews. A comparable structure exists: Turner launched its own rental company, First Equipment Company, on January 8, 2026.

### 8. "What's the hardest technical part?"

Availability and allocation. A unit is only bookable if the check-out log and the schedule both say it is free for the whole date range. Physical units cannot be in two places at once, and transport changes the economics, so a per-request ranking is not enough. Then explainability: every recommendation has to show both cost lenses, a reason and a breakdown, or a project manager will not trust it. We chose a greedy allocator first because a working, explainable plan beats an optimal plan nobody can follow. On a static snapshot of the 16 upcoming requests, an exact PuLP/CBC solver is 2.1% ($2,825) cheaper than a greedy pass under the same model. The live plan uses a richer model, so it is not graded by that number. (see Q11).

### 9. "What about security, privacy and access to SAP?"

The design reads SAP and Procore read-only, through their exports; the app writes only its own check-out log and imported rows to local SQLite. The demo imports CSV files; it has no live SAP or Procore connection. The financial data stays local in SQLite, and the check-out log creates an audit trail of where group assets are. The demo has no authentication, no multi-tenant isolation and no live credentials; those are production requirements, not demo features. The target group's real name and numbers never enter the public repo.

### 10. "What did you actually build, and what's next?"

Real code: FastAPI routes, SQLite schema and imports, availability, the cost model, transport, the greedy allocator, the PuLP/CBC static min-cost comparison, the backtest, the fleet advisor, the React screens, the map, CSV upload, provenance, and 211 tests (106 backend, 105 frontend). Mocked or roadmap: live SAP/Procore/Textura APIs, real history, the Textura leak report, live re-solving, auth and mobile. Next is a 60-day read-only pilot on one group's real export, then the leak report and the live re-solve (Q11).

### 11. "Your exact solver beats greedy. Why not just ship the optimal plan?"

On a static snapshot of the 16 upcoming requests, min-cost is $131,169 against greedy's $133,993 under the same model, so $2,825 (2.1%) lower. The live plan uses a richer model, so that number does not grade it: the live plan costs $133,928, and the static model is not a floor for it. We don't swap in the static solution because it does not re-price relocation and only allows buy when no unit is free; a live plan also has to respect machines already on trucks. The Timeline's re-plan card already runs the exact solver as a suggestion: it locks started requests and charges a switching cost for any change. The comparison is on the Dashboard.

---

### 12. "Your engine has a Buy option, but the demo never buys. Does it work?"

Yes, and the demo shows why. Buy has to pay on one extra unit, not on the whole pipeline. For the generator, one more unit covers 308 days of demand: $10,050 of outside rent avoided against $13,800 a year to own, so it loses $3,750 and the engine rents outside. The fleet advisor uses the same math and agrees. Buy appears when a unit's net is positive; with these rates and this pipeline, none is. The rates are mostly placeholders, so a different rate card could change that.

---

### 13. "Isn't Rentel, or Tenna's rent/buy insight, already this?"

Rentel, launched in March 2026, recommends buy, sell, move or rent with projected dollar impact, but it is built for rental companies and dealers. Tenna markets buying, renting and reallocating decisions from utilization data. Procore forecasts project equipment needs and availability. None publicly says it ranks move-owned, rent-from-sister, rent-outside and buy by group cost across several legal entities from future schedules. We have not tested them, and a demo may show more.

### 14. "You accepted Riverside's lifts, then the what-if flipped them. Isn't an accepted plan a booking?"

Not yet. Accept records the recommendation; it does not reserve the machine. After a what-if the engine re-prices it, and the Dashboard marks that row "changed by what-if" and drops it from the kept total, so nothing changes silently. Booking locks are planned for the pilot.

---

## Bonus: "Why is the team all CS?"

We accept the rubric hit. The industry helper gave us the workflow and the price ranges, and we labelled every inference. The pilot is how we close the domain gap: the coordinator's actual decisions become the ground truth.

### 15. "Alberta's $6.4B is bigger than Canada's $6.3B?"

Different categories. Statistics Canada covers all commercial and industrial machinery rental and leasing. ARA covers construction equipment and general tool rental. We never add or compare them directly.

### 16. "Who keeps the check-out log? Is that a tracker with a clipboard?"

A coordinator keeps it in the app, and schedules fill the gaps. It needs discipline, so where the log and schedule disagree a person confirms. The pilot measures how often that happens.
