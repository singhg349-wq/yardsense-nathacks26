# YardSense — 5-minute spoken script

**Pace:** ~140 words per minute. **Spoken length:** 661 words ≈ 4:43, leaving ~15 s of slack for clicks. **Speakers:** lead + demo driver. **Rule:** say the fictional group name; never the real one.

> **UI restyle (Sun Nov 8):** the app is being restyled today — navy + safety orange, cost bars on Requests, a legend on the Timeline. The demo click path stays the same. Lines marked **[re-check UI]** quote on-screen text; re-read them against the new UI after the redesign lands.

---

## 0:00–0:55 — Story (lead)

Monday, 7:10 a.m.

Priya, superintendent on Riverside Clinic, needs two scissor lifts, a telehandler and a 45-kilowatt generator for ten weeks. She asks Dana, the equipment coordinator at Northgate Builders.

Dana has an SAP asset register, an out-of-date spreadsheet and a phone.

Forty-five minutes later, Dana books everything from an outside rental company. That's not a mistake. That's what you do at 7:55 on a Monday with a site waiting.

At month-end, Riverside's equipment line is fourteen thousand dollars over budget.

## 0:55–1:20 — Hidden facts + insight (lead)

Here's what Dana couldn't see. The group's telehandler is idle at Westgate Tower. Northgate Rentals, our sister company, has lifts parked in its yard. And four upcoming projects each plan to rent a generator.

Money left the group three times, and nobody did anything wrong.

To the project, a scissor lift from our rental company at seven ninety-two for four weeks and from outside at nine hundred look about the same. To the group, the first is a unit that was idle anyway. The second is nine hundred dollars gone.

The cheapest option for a project is not the cheapest option for the group.

## 1:20–3:40 — Live demo (demo driver)

Here's Priya's request in YardSense. Three items, ten weeks.

For each item, the engine ranks four options by group cost: move ours, rent from our sister company, rent outside, or have the sister company buy. Each shows project cost next to group cost, and a **"Why this?"** breakdown. **[re-check UI]**

Scissor lifts: rent from Northgate Rentals. Telehandler: move ours from Westgate — ten point six kilometres, a hundred ninety-eight dollars of trucking. Generator: rent outside. One more generator would lose three thousand seven hundred fifty dollars a year, so the engine refuses to buy.

I accept all three. The **kept-in-group counter** rises. **[re-check UI]**

Now the Timeline. I drag Kingsway six weeks later as a what-if. The plan re-runs: **two recommendations change**. Kingsway's scissor phase now starts first and takes the two idle lifts at Northgate Rentals, so Riverside's lifts, and one at Capilano, go to outside rental. One slip ripples across projects. **[re-check UI]** The drag doesn't edit the schedule; the real path is a revised schedule import, which we'll show.

The Map shows each move, its distance and its truck cost.

The Dashboard shows the synthetic backtest: ninety-six past requests, fifteen rental leaks, forty-eight thousand dollars of outside spend avoided out of two hundred eighty-six. The availability rates are our input, so it shows the method, not a forecast.

The Fleet advisor tells the rental company what the next twelve months imply: retire one idle mini excavator, and add nothing. It agrees with the generator call.

Last, Data upload: **Load slipped schedule demo**. **[re-check UI]** Same change, through the real-data path.

## 3:40–4:10 — How it works (lead)

Every source enters through a connector into one set of tables; the engine reads only the tables.

Availability comes from the check-out log kept in the app plus the schedule. Transport uses a saved driving-distance matrix. The allocator reserves physical units across overlapping dates.

On a static snapshot of sixteen requests, an exact solver is two point one percent cheaper than a greedy pass under the same model. That doesn't grade the live plan. Every number carries a source and a confidence label, and a hundred two backend and a hundred three frontend tests pass.

## 4:10–4:40 — Competitors + business (lead)

Tenna needs trackers and looks at past usage. Procore Equipment looks at one company, one project at a time. HCSS and the rental ERPs run dispatch and billing. We're the group-level decision layer: all companies, future schedules, group cost. If the group uses Procore, we sit on top.

The buyer is a group that owns its own rental company. The model is a per-group subscription or a paid pilot. Pricing isn't final, and we haven't run customer interviews.

## 4:40–5:00 — Close (lead)

The data is synthetic and labelled; the engine is real. Next is a sixty-day pilot on one group's real SAP and Procore exports.

The cheapest option for one project isn't the cheapest for the group. We built the engine that looks at the group.

Thank you.

---

## Demo fallback if the live app fails

1. Show the 60-second backup video.
2. Walk the deck slides 4–8.
3. Say: "The tests and the synthetic backtest are in the repo; the demo runs on localhost."

## Cues

- **Before the talk:** `python backend/scripts/reset_db.py`, start backend and frontend, open Requests, remove browser bookmarks, zoom to 110%.
- **During the demo:** one driver, one narrator. Do not debug live. If a screen errors, switch to the backup video.
- **Running long:** cut the Data upload line (the Timeline flip already makes the point), then the Fleet advisor.
- **After the demo:** return to the deck for the backtest and business slides.
