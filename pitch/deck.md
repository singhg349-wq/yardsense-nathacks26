# YardSense: deck outline

Generated from `pitch/YardSense-Final-Draft.pptx`. 13 main slides plus 3 backup slides. Every number is engine output, sourced, or labelled proposed or synthetic.

## Slide 1: YardSense

- We help construction groups stop renting what they already own
- Northgate Group demo · natHacks 2026 · Construction & Manufacturing

**Speaker notes:** [0:05] Construction groups rent machines they already own. We built YardSense to stop that.

## Slide 2: One routine request sent $23,208 outside the group

- Priya, superintendent on Riverside Clinic, needs 2 scissor lifts, a telehandler and a 45 kW generator for 10 weeks / Dana, the equipment coordinator, has an SAP register that does not say what is free, a stale spreadsheet and a phone / 45 minutes later, everything is booked outside: the reasonable call under time pressure
- $23,208 / left the group for one request
- Engine-priced output for the fictional Northgate Group; most rates are labelled placeholders

**Speaker notes:** [0:20] Monday, 7:10 a.m. Priya needs two scissor lifts, a telehandler and a generator for ten weeks. Dana has an SAP register that doesn't say what's free, a stale spreadsheet and a phone. Forty-five minutes later it's all booked outside. Twenty-three thousand dollars leaves the group, and nobody did anything wrong.  Number: live engine, all-outside cost of Riverside's three demo needs ($5,198 + $15,420 + $2,590).

## Slide 3: Three idle machines sat unused while the money left

- 1 telehandler / Idle at Westgate Tower since framing finished
- 2 scissor lifts / Parked in the Northgate Rentals yard
- The trap: buy a generator / 4 projects each rent a 45 kW unit, yet one more would lose $3,750 a year
- Contractors don't have an equipment shortage. They have a visibility problem.
- Caltrans audit (2018): owned equipment was available for 9 of 32 rentals justified by breakdowns. Three districts, not a fleet-wide rate.

**Speaker notes:** [0:15] Here's what Dana couldn't see. A telehandler idle at Westgate. Two lifts in our own rental yard. And a trap: four projects each renting a generator, where buying one would actually lose $3,750 a year. Contractors don't have an equipment shortage. They have a visibility problem.  Footnote if asked: Caltrans audit, public agency, three districts, 32 rentals justified by broken-down units. Not a fleet-wide rate.

## Slide 4: The same plan saves the project 11% and the group 66%

- What the project pays
- $23,208
- $20,770
- What the group really pays
- $23,208
- $7,956
- Book everything outside
- YardSense recommendation
- $15,252 / stays in the group. Internal rent moves between sister companies; only trucking and wear are real cost.
- Nobody's job today is to look at the group number. YardSense's job is only that.
- Riverside's three demo needs, live engine output; fictional group, mostly placeholder rates

**Speaker notes:** [0:20] Our plan saves the project eleven percent. Barely worth a phone call. It saves the group sixty-six percent, because internal rent stays in the family and only trucking and wear are real cost. Nobody's job today is to look at the group number. That's ours.  Numbers: project $23,208 to $20,770; group $23,208 to $7,956. $15,252 stays in the group.

## Slide 5: YardSense ranks four options by what the group really pays

- Move ours / Truck over an idle unit the group owns
- Rent sister / Idle unit from Northgate Rentals
- Rent outside / The fallback, at full market rate
- Buy / Only if one extra unit pays for itself
- 1  Reads / SAP and Procore exports plus a check-out log. No trackers.
- 2  Ranks / Project cost beside group cost, with a reason for each.
- 3  Re-plans / When a schedule slips, the plan re-runs across projects.

**Speaker notes:** [0:15] For every request, YardSense ranks four options by what the group really pays. It reads the SAP and Procore exports the group already has, plus a check-out log. When a schedule slips, it re-plans.

## Slide 6: Live Demo

- New request → ranked options → CSV upload — about 1 minute, 2x speed
- ▶  Drop the 2x-speed screen recording here / (new request entry + CSV upload) / Insert → Video in Slides, or paste a Drive/YouTube link
- Timeline / slip 6 weeks: 2 requests flip
- Map / routes & moves
- Dashboard / $ kept, idle days
- Fleet Advisor / retire 1, add none
- Static screens — clicked through quickly, not narrated in depth

**Speaker notes:** [1:20] Let the recording run: new request, ranked options, CSV upload. Then click through the four screens fast. Timeline: slip Kingsway six weeks. Its lifts now start first and take the two idle Northgate Rentals units, so Riverside's and one at Capilano go outside. Anything already accepted is flagged 'changed by what-if'. Fleet advisor: retire one idle mini excavator, add nothing.

## Slide 7: 16.8%

- of outside rental spend would have stayed in the group: $48,112 of $286,266, replayed across 96 synthetic requests over 12 months, with 15 rental leaks found.
- Deterministic synthetic replay, not a customer result. It assumes about 1 in 5 rentals had an idle unit, so it shows the method, not a forecast.

**Speaker notes:** [0:15] We replayed a synthetic year of 96 requests. About 17% of outside spend would have stayed in the group. The availability rate is our input, so this shows the method, not a forecast.

## Slide 8: An exact solver checks the method, and the engine refuses bad buys

- 2.1% / Exact PuLP/CBC solve below greedy on a 16-request snapshot. A method check, not a grade of the live plan.
- -$3,750 / A year of one more generator: $10,050 rent avoided, $13,800 to own. So it rents.
- 211 / Backend and frontend tests. Key numbers in this pitch are pinned by tests.
- SAP and Procore exports enter through connectors into one set of tables. The app labels each data source and rate by confidence.

**Speaker notes:** [0:20] Two reasons to trust it. On a sixteen-request snapshot, an exact solver is two point one percent below a greedy pass under the same model. That checks the method; it doesn't grade the live plan. And the engine refuses bad buys: one more generator covers $10,050 of rent against $13,800 to own.  If asked: the generator result depends on placeholder owning costs. Maintenance and insurance would need to fall from $500 to about $188 a month to break even.

## Slide 9: We found no public tool that ranks all four options across a group of companies

|   | Tenna | Procore Equipment | HCSS / rental ERPs | YardSense |
|---|---|---|---|---|
| Starts from | Tracker hardware | OEM telematics | Dispatch, upkeep | Exports you have |
| Looks at | Live + past use | Project needs | Daily operations | Future demand |
| Multi-company | Not shown | Not shown | Not shown | Whole group |
| Optimizes for | Utilization | Job allocation | Operations | Group cost |
- Public-web review of about 20 platforms, not hands-on testing. If a group already uses Procore, YardSense sits on top as the group-level planning layer.

**Speaker notes:** [0:15] Tenna is tracker-led. Procore plans equipment by project. HCSS and the rental ERPs run operations. In a public review of about twenty platforms, we found none that ranks all four options across legal entities from future schedules.  If asked: Rentel (2026) recommends buy, sell, move or rent, but for rental companies and dealers. Wynne RentalResult runs internal and external rentals in one process. Tenna, owned by Deere, markets buying, renting and reallocating decisions from utilization data. Procore forecasts project equipment needs. We have not tested them.

## Slide 10: Contractors are building their own rental arms, starting with Turner

- $83.5B
- US equipment and tool rental, 2026 forecast (ARA)
- $6.3B
- Canada, same forecast (ARA)
- 35.3%
- Alberta share of Canadian machinery rental and leasing revenue, 2024 (StatCan)
- The structure exists / Turner's First Equipment Company (2026), JE Dunn's Blue Hat, McGough's Six Side Supply
- Entry market: about $7.9M a year / 440 ranked contractors (ENR Top 400, On-Site Top 40) at $18K. Not all own a rental arm.
- ARA coverage does not name a currency. Entry market is our arithmetic, not a forecast. Sources in the appendix.

**Speaker notes:** [0:20] Turner, the largest US contractor, launched its own rental company in January 2026. JE Dunn and McGough have theirs. Rental is about a ninety-billion-dollar North American market, and Alberta is over a third of Canada's machinery rental revenue, so we start here. 440 ranked contractors at the entry price is about eight million a year.  Caveats: ARA coverage does not state the currency. StatCan is a broader category that includes leasing. We have not counted how many of the 440 own a rental arm, and we found no survey that does.

## Slide 11: A proposed $1,500 a month pays back 2.7x on the replay

- Group pays / $18,000 / a year: $1,500 a month per group, 3-month pilot minimum
- vs
- Group keeps / $48,112 / a year of outside spend avoided in the synthetic replay
- 2.7x / payback
- One Riverside-size request keeps $15,252 in the group: about 10 months of subscription
- Proposed price. Synthetic replay. No customer has validated either yet.

**Speaker notes:** [0:15] We propose fifteen hundred dollars a month per group. Against the synthetic replay that's 2.7 times payback, and one Riverside-size request covers about ten months. No customer has validated this price; the pilot will.  PROPOSED PRICE: team to confirm.

## Slide 12: Nine months to a paid pilot on real data

- Months 1-3: Prove the data / Map one real SAP and Procore export / Interview 5 coordinators / Add sign-in and audit log
- Months 4-6: Shadow pilot / 60 days, read-only, one Edmonton GC group with a rental arm / Coordinator decides as usual
- Months 7-9: Paid pilot / Measured savings replace the replay / Convert pilot 1, start pilot 2
- Pilot passes if / 50+ real requests, 70%+ of recommendations accepted, measured savings at least 3x the fee
- $2,000 seed / Legal and pilot agreement $600, hosting $540, site visits $360, tools $200, reserve $300

**Speaker notes:** [0:20] Three months to prove the data on a real export and interview coordinators. Then a sixty-day shadow pilot: read-only, the coordinator decides as usual, and we compare. Then a paid pilot with measured savings replacing our synthetic number.  PROPOSED TARGETS AND BUDGET: team to confirm.

## Slide 13: The cheapest option for one project isn't the cheapest for the group.

- We built the engine that looks at the group.
- Our ask: one contractor group willing to share a read-only export
- Gurshmeer Singh · Rakshit Singh · Sreeman Reddy · Aarish Naiyer · Anant — natHacks 2026

**Speaker notes:** [0:15] The cheapest option for one project isn't the cheapest for the group. We built the engine that looks at the group. Our ask: connect us with one group willing to share a read-only export. Thank you.

## Slide 14: Backup: the constraints we have planned for

| Constraint | How we handle it |
|---|---|
| Messy SAP or Procore data | Validation on import; shadow pilot before any real decision |
| Internal unit is not a true match | Add attachment, condition and operator rules as constraints |
| Rental arm could rent it outside | Add an opportunity-cost term to group cost |
| Coordinators may not trust it | "Why this?" breakdown; read-only recommendations first |
| Accepted plans are not reservations yet | What-ifs flag changes today; add booking locks in the pilot |
| No sign-in in the prototype | Sign-in, audit log and read-only scopes before real data |

**Speaker notes:** Backup slide for Q&A: Feasibility.

## Slide 15: Backup: real, synthetic and not built yet

- Real code / FastAPI, SQLite, six React screens / Availability, cost model, allocator / Backtest, fleet advisor, CSV import / 211 tests
- Synthetic or assumed / Northgate Group and its projects / Backtest history and 1-in-5 idle rate / Most rates; two 4-week rates are sourced / Proposed price and pilot targets
- Not built yet / Live SAP, Procore, Textura APIs / Textura leak report / Sign-in and multi-tenant / Customer interviews

**Speaker notes:** Backup slide for Q&A: what is real and what is synthetic.

## Slide 16: Backup: sources

- Turner: turnerconstruction.com/insights/turner-construction-company-launches-first-equipment-company / JE Dunn: bluehatrentals.com; centennial.jedunn.com/blog/from-the-warehouse-to-blue-hat-je-dunns-equipment-story / McGough: rentalresult.com/resources/treating-equipment-like-a-business / Rental forecast: ARA via Heavy Equipment Guide, Aug 25 2026: heavyequipmentguide.ca/article/44867 / Alberta: Statistics Canada, The Daily, Dec 2 2025: www150.statcan.gc.ca/n1/daily-quotidien/251202/dq251202d-eng.htm / Audit: Caltrans IOAI P3010-0636 (2018): ig.dot.ca.gov/publications/p3010-0636 / Contractor lists: enr.com/toplists/2026-Top-400-Contractors-1; on-sitemag.com/top-contractors / Rates: DOZR public listings for the 19 ft scissor lift and telehandler; other rates are labelled placeholders in the app / Engine numbers: YardSense repo tests: test_pitch_numbers.py, test_demo_numbers.py, test_backtest.py

**Speaker notes:** Backup slide: sources.
