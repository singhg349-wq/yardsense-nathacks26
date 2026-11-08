# YardSense — 5-minute spoken script

**Pace:** ~140 words per minute. **Speakers:** lead + demo driver. **Rule:** say the fictional group name; never the real one.

---

## 0:00–1:00 — Story (lead)

It's Monday, 7:10 in the morning.

Priya, the superintendent on Riverside Clinic, needs two scissor lifts, a telehandler and a 45-kilowatt generator for ten weeks. She sends the request to Dana, the equipment coordinator at Northgate Builders.

Dana's tools are an SAP asset register, a spreadsheet that is already out of date, and a phone. SAP knows what the group owns. It does not know where anything is, or whether it is free.

Forty-five minutes later, Dana books everything from an outside rental company. That is not a mistake. That is what you do at 7:55 on a Monday with a site waiting.

At month-end, Riverside's equipment line is fourteen thousand dollars over budget.

## 1:00–1:20 — Hidden facts + insight (lead)

Here is what Dana could not see. The group's telehandler has been sitting idle at Westgate Tower since framing finished. Northgate Rentals, our own sister company, has two lifts parked in its yard. And four upcoming projects each plan to rent a generator.

Money left the group three times, and nobody did anything wrong.

To one project, nine hundred dollars a week from our rental company and nine hundred and fifty from outside look about the same. To the group, the first is money staying in the family on a unit that was idle anyway. The second is nine hundred and fifty dollars gone.

The cheapest option for a project is not the cheapest option for the group. Nobody's job today is to look at the group number.

## 1:20–3:40 — Live demo (demo driver)

So here is Priya's request in YardSense. Three items, ten weeks, Riverside Clinic.

For each item, the engine ranks four options by group cost: move ours, rent from our sister company, rent outside, or have the sister company buy it. Every option shows project cost next to group cost, a reason, and a "Why this?" breakdown.

The scissor lifts come from Northgate Rentals. The telehandler is moved from Westgate. The generator is bought through Northgate Rentals, because four pipeline projects need one and it breaks even within six months.

I accept the recommendations. The kept-in-group counter rises.

Now the Timeline. This is the plan management sees: two lenses, a plan snapshot, and the option mix. I can drag Kingsway six weeks later as a what-if. The engine re-runs, and the generator flips from buy to rent outside. The banner shows five changes on the seed; the generator is the headline. The whole plan re-runs, not just one line. This is a what-if; it does not edit the Procore schedule. The real change is a revised schedule import, which we can also show.

The Map shows the moves, the driving distances and the truck cost. The Dashboard shows accepted savings, idle days, and the synthetic backtest: one hundred thirty-seven thousand dollars of outside spend avoided out of two hundred seventy-five thousand, about fifty percent, with thirty-five rental leaks.

The Fleet advisor tells the rental company what the next twelve months imply: add two boom lifts, add two heaters, retire a mini excavator and a plate compactor.

## 3:40–4:15 — How it works + rigor (lead)

Under the hood, everything enters through a connector into one set of tables, and the engine reads only the tables.

Availability comes from Dana's check-out log plus schedule inference: a unit frees when its project phase ends. The cost model computes project cost and group cost separately. Transport uses a saved OpenStreetMap driving-distance matrix, with a straight-line fallback. The allocator reserves physical units across overlapping dates. The backtest replays a year of synthetic decisions. We also solve the same snapshot exactly with PuLP: min-cost is two point two percent below greedy, so we keep the explainable plan and show the comparison. Every number has a source and a confidence label.

## 4:15–4:45 — Competitors + business (lead)

Tenna is a telematics tool: trackers, past usage. Procore Equipment looks at current usage, one company and one project at a time. HCSS and the rental ERPs run dispatch and billing. We are the group-level decision layer: all companies, future schedules, group cost. If the group already uses Procore, we sit on top.

The buyer is a group that owns its rental company. Turner launched one in January. The model is a per-group subscription or a paid pilot. We have not finalized pricing, and we have not run customer interviews.

## 4:45–5:00 — Close (lead)

We built the engine, the demo and the tests. The data is synthetic and labelled; the engine is real. The next step is a sixty-day pilot on one group's real SAP and Procore export.

The cheapest option for one project is not the cheapest for the group. We built the engine that looks at the group.

Thank you.

---

## Demo fallback if the live app fails

1. Show the 60-second backup video.
2. Walk the deck slides 4–8.
3. Say: "The tests and the synthetic backtest are in the repo; the demo runs on localhost."

## Cues

- **Before the talk:** `python backend/scripts/reset_db.py`, start backend and frontend, open Requests, remove browser bookmarks, zoom to 110%.
- **During the demo:** one driver, one narrator. Do not debug live. If a screen errors, switch to the backup video.
- **After the demo:** return to the deck for the backtest and business slides.
