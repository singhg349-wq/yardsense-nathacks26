# YardSense: 5-minute spoken script

**Spoken length outside the demo:** 473 words at about 140 words a minute, plus 1:20 for the demo slide. **Rule:** say the fictional group name; never the real one.

## Slide 1 (0:05): YardSense

Construction groups rent machines they already own. We built YardSense to stop that.

## Slide 2 (0:20): One routine request sent $23,208 outside the group

Monday, 7:10 a.m. Priya needs two scissor lifts, a telehandler and a generator for ten weeks. Dana has an SAP register that doesn't say what's free, a stale spreadsheet and a phone. Forty-five minutes later it's all booked outside. Twenty-three thousand dollars leaves the group, and nobody did anything wrong.

## Slide 3 (0:15): Three idle machines sat unused while the money left

Here's what Dana couldn't see. A telehandler idle at Westgate. Two lifts in our own rental yard. And a trap: four projects each renting a generator, where buying one would actually lose $3,750 a year. Contractors don't have an equipment shortage. They have a visibility problem.

## Slide 4 (0:20): The same plan saves the project 11% and the group 66%

Our plan saves the project eleven percent. Barely worth a phone call. It saves the group sixty-six percent, because internal rent stays in the family and only trucking and wear are real cost. Nobody's job today is to look at the group number. That's ours.

## Slide 5 (0:15): YardSense ranks four options by what the group really pays

For every request, YardSense ranks four options by what the group really pays. It reads the SAP and Procore exports the group already has, plus a check-out log. When a schedule slips, it re-plans.

## Slide 6 (1:20): Live Demo

Let the recording run: new request, ranked options, CSV upload. Then click through the four screens fast.

Timeline: slip Kingsway six weeks. Its lifts now start first and take the two idle Northgate Rentals units, so Riverside's and one at Capilano go outside. Anything already accepted is flagged 'changed by what-if'.

Fleet advisor: retire one idle mini excavator, add nothing.

## Slide 7 (0:15): 16.8%

We replayed a synthetic year of 96 requests. About 17% of outside spend would have stayed in the group. The availability rate is our input, so this shows the method, not a forecast.

## Slide 8 (0:20): An exact solver checks the method, and the engine refuses bad buys

Two reasons to trust it. On a sixteen-request snapshot, an exact solver is two point one percent below a greedy pass under the same model. That checks the method; it doesn't grade the live plan. And the engine refuses bad buys: one more generator covers $10,050 of rent against $13,800 to own.

## Slide 9 (0:15): We found no public tool that ranks all four options across a group of companies

Tenna is tracker-led. Procore plans equipment by project. HCSS and the rental ERPs run operations. In a public review of about twenty platforms, we found none that ranks all four options across legal entities from future schedules.

## Slide 10 (0:20): Contractors are building their own rental arms, starting with Turner

Turner, the largest US contractor, launched its own rental company in January 2026. JE Dunn and McGough have theirs. Rental is about a ninety-billion-dollar North American market, and Alberta is over a third of Canada's machinery rental revenue, so we start here. 440 ranked contractors at the entry price is about eight million a year.

## Slide 11 (0:15): A proposed $1,500 a month pays back 2.7x on the replay

We propose fifteen hundred dollars a month per group. Against the synthetic replay that's 2.7 times payback, and one Riverside-size request covers about ten months. No customer has validated this price; the pilot will.

## Slide 12 (0:20): Nine months to a paid pilot on real data

Three months to prove the data on a real export and interview coordinators. Then a sixty-day shadow pilot: read-only, the coordinator decides as usual, and we compare. Then a paid pilot with measured savings replacing our synthetic number.

## Slide 13 (0:15): The cheapest option for one project isn't the cheapest for the group.

The cheapest option for one project isn't the cheapest for the group. We built the engine that looks at the group. Our ask: connect us with one group willing to share a read-only export. Thank you.

## Demo fallback if the live app fails

1. Show the backup video.
2. Walk the deck from slide 7.
3. Say: "The tests and the synthetic backtest are in the repo; the demo runs on localhost."

## Cues

- **Before the talk:** `python backend/scripts/reset_db.py`, start backend and frontend, open Requests, hide bookmarks, zoom to 110%.
- **During the demo:** one driver, one narrator. Do not debug live. If a screen errors, switch to the backup video.
- **Running long:** cut the market detail on slide 10, then the exact-solver card on slide 8.
