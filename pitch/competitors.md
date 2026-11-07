# Competitors

Rule: only claims from `plan.md`. Anything else is marked **(to verify)**. Nothing here uses real numbers.

## Slide table

| | Tenna | Procore Equipment | HCSS Dispatcher | Rental ERPs (Wynne, Point of Rental) | **YardSense** |
|---|---|---|---|---|---|
| Needs trackers/telematics | Yes | Optional (telematics GA Jan 2026) | (to verify) | (to verify) | **No.** Reads data the group already has |
| Looks at | Past usage | Current project usage | (to verify) | (to verify) | **Future demand from schedules**, re-planned when schedules move |
| Scope | One company's fleet | One company, project by project | (to verify) | (to verify) | **Whole group**: GC + rental sister + trades |
| Optimizes for | Utilization | Project cost | (to verify) | (to verify) | **Group cost** (fixes the project-vs-group mismatch) |
| Sub-billed rentals | No | No | (to verify) | (to verify) | **Yes, through Textura** (pending confirmation) |
| SAP | No SAP integration found (COINS, Sage) | Its own platform | (to verify) | (to verify) | **Reads SAP** |
| Owner | John Deere | Procore | (to verify) | (to verify) | Neutral |

Note: plan.md names HCSS and the rental ERPs as competitors to show, but gives no facts about them. Fill those columns before the pitch, or drop them from the slide and say their names out loud.

## One-liner

"Tenna and Procore tell you how your equipment **was** used. YardSense tells your **whole group of companies** what to move, rent or buy **next**, with no trackers, using the SAP and Procore data you already have."

## If they already use Procore Equipment

"Keep it. YardSense is the group-level planning layer on top: Procore Equipment runs one company, project by project. We look across the whole group and its rental company, and tell you what to move, rent or buy next." (Whether the target group uses Procore Equipment is still an open item in plan.md.)

## Likely judge questions

**1. "Procore already has equipment tracking. Why would anyone need this?"**
Procore Equipment looks at current usage, one company and one project at a time, and optimizes project cost. We look at future demand across the whole group and optimize group cost. If they use it, we sit on top of it.

**2. "Does it work without any hardware?"**
Yes. It reads the SAP asset register, Procore schedules and Textura billing data the group already has. Idle status comes from Dana's check-out/in log plus the schedules: a unit frees up when its project phase ends.

**3. "How do you know the numbers are right?"**
The demo group and data are fictional, tuned with an industry helper's input. Every recommendation shows both cost lenses (project cost and group cost), with a "Why this?" breakdown. We replay 12 months of synthetic past requests to show what would have stayed in the group. It is a backtest on synthetic data, not a customer result, and we say so.
