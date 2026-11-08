# Judge Q&A — 10 hard questions, tight answers

**Rule:** answer in 20–40 seconds. Concede the true part, then give the specific defence.

---

### 1. "Isn't this a textbook assignment problem?"

The optimization is familiar; the product is not the solver. The hard part is the data model and the decision context: what is actually free, what the group pays versus what the project pays, how future demand changes a buy decision, and how to explain the answer to a project manager. We ship a greedy allocator that is easy to follow, and we built an exact PuLP/CBC static comparison: min-cost is 2.2% below greedy, but the live plan stays greedy because the exact model is a static snapshot. A textbook assignment problem does not have a check-out log, a sister rental company, or a schedule that moves.

### 2. "Procore already has equipment tracking. Why would anyone need this?"

Procore Equipment looks at current usage, one company and one project at a time, and optimizes project cost. We look at future demand across the whole group — the GC, the sister rental company and the trades — and optimize group cost. If the group already uses Procore Equipment, we sit on top as the group-level planning layer, not as a replacement. We are not claiming Procore cannot track equipment; we are claiming nobody is making the group-level move/rent/buy decision from the future pipeline.

### 3. "The data is fake. Why should we trust the numbers?"

You should not treat them as a customer result. The data is synthetic, and we say so in the app, the README and the pitch. What is real is the engine: it prices four options, reserves physical units, re-plans on a schedule change and replays a year of decisions. The provenance page labels every number as sourced, derived, placeholder or synthetic. The two market rates we use are sourced; the rest are tuning values. The next step is a pilot with the group's real SAP and Procore export.

### 4. "How do you know what's idle without trackers?"

Two signals: Dana's check-out and check-in log, and schedule inference. If a unit is checked out to a project and has not been checked in, it is busy. If it has not been checked in, the project's last planned need for that class tells us when the work ends, so the unit is released then. We are not claiming GPS. We know which project the unit went to and when its work should end, and the log creates an audit trail.

### 5. "What if the internal unit isn't a true match — wrong attachment, poor condition, no operator?"

Then it should not be offered, and the economics should say so. The engine matches on equipment class and availability; a production version adds suitability rules — attachments, condition, certifications, operator — as constraints. If the internal unit is not a true match, outside rental wins, and the tool should show that. Our current demo is the conservative case: it only offers a unit when the class and dates match.

### 6. "Why would the sister rental company cooperate? Doesn't internal rental cannibalize its outside revenue?"

The group owns both companies, so the group keeps the margin either way; the internal rate is still revenue to the rental arm. The real question is opportunity cost: if the unit could be rented to an outside customer at full rate, the group cost is not just transport and wear. Our current demo assumes the unit is idle, which is the conservative case for recommending internal use. The roadmap adds an opportunity-cost term when the rental arm has outside demand. That is also a good reason to run the pilot: it tells us how often the unit would otherwise be rented.

### 7. "Who pays for this, and how much?"

The buyer is the group, not the individual project. The value is outside rental avoided and better fleet decisions across the group. The likely model is a per-group SaaS subscription, or a paid pilot per project. We have not finalized pricing and we have not run customer interviews, so the commercial evidence is capped. The buyer structure is real: Turner launched its own rental company, First Equipment Company, in January 2026.

### 8. "What's the hardest technical part?"

Availability and allocation. A unit is only bookable if the check-out log and the schedule both say it is free for the whole date range. Physical units cannot be in two places at once, and transport changes the economics, so a per-request ranking is not enough. Then explainability: every recommendation has to show both cost lenses, a reason and a breakdown, or a project manager will not trust it. We chose a greedy allocator first because a working, explainable plan beats an optimal plan nobody can follow. We also solved the same static snapshot exactly with PuLP/CBC: min-cost is 2.2% below a like-for-like greedy, but we do not ship it as the live plan because it does not re-price relocation and it only allows buy when no unit is free.

### 9. "What about security, privacy and access to SAP?"

The connectors are read-only and least-privilege in the design: SAP asset register, Procore schedules, check-out log. The financial data stays local in SQLite, and the check-out log creates an audit trail of where group assets are. The demo has no authentication, no multi-tenant isolation and no live credentials; those are production requirements, not demo features. The target group's real name and numbers never enter the public repo.

### 10. "What did you actually build, and what's next?"

Real code: FastAPI routes, SQLite schema and imports, availability, the cost model, transport, the greedy allocator, the PuLP/CBC static min-cost comparison, the backtest, the fleet advisor, the React screens, the map, CSV upload, provenance, and 148 tests. Mocked or roadmap: live SAP/Procore/Textura APIs, real history, the Textura leak report, a dynamic optimizer, auth and mobile. Next is a 60-day read-only pilot on one group's real export, then the leak report and a dynamic optimizer if the pilot shows the gap.

---

## Bonus: "Why is the team all CS?"

We accept the rubric hit. The industry helper gave us the workflow and the price ranges, and we labelled every inference. The pilot is how we close the domain gap: the coordinator's actual decisions become the ground truth.
