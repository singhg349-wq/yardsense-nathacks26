# 60-second backup video — shot list

**Purpose:** if Wi-Fi, the projector or the live app fails, play this. Record it before the pitch, not during the event.
**Format:** 1920×1080, 30 fps, MP4 (H.264). **Length:** 55–60 seconds. **Audio:** voice-over, no music.

---

## Before recording

1. `python backend/scripts/reset_db.py`
2. Start backend (`uvicorn app.main:app --reload`) and frontend (`npm run dev`).
3. Open `http://localhost:5173`, zoom to 110%, hide bookmarks, close other tabs.
4. Use the fictional Northgate Group only. No real names, numbers or Discord.
5. Record 3 takes. Pick the cleanest. Do not edit in a rush.

---

## Shot list

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:05 | Title card: **YardSense** — "The group-level equipment decision engine" | "A construction group rents outside while its own equipment sits idle." |
| 0:05–0:15 | Requests tab, Riverside Clinic, three items | "Priya needs two scissor lifts, a telehandler and a generator for ten weeks." |
| 0:15–0:30 | Ranked options; open "Why this?" on the telehandler; accept | "YardSense ranks four options by what the whole group pays: move ours, rent from sister, rent outside, or buy." |
| 0:30–0:40 | Timeline; drag Kingsway six weeks; two recommendations change | "When a schedule slips, the engine re-runs. Kingsway takes the sister-yard lifts, so Riverside's go outside." |
| 0:40–0:50 | Dashboard backtest + Fleet advisor | "A synthetic year-long replay shows the method, not a forecast; the fleet advisor says what to retire, and it refuses to buy a generator that loses money." |
| 0:50–0:60 | Data upload provenance + closing card | "No trackers. It reads SAP and Procore exports and a check-out log kept in the app. Synthetic data, labelled; the engine is real." |

**Total narration:** ~135 words. Read at ~140 wpm.

---

## Recording checklist

- [ ] Screen recorder at 1080p; system audio off; microphone on.
- [ ] Cursor moves slowly; no rapid scrolling.
- [ ] Pause 1 second before each click so the viewer can follow.
- [ ] No backend error toasts; reset the DB first.
- [ ] Export MP4; play it once end-to-end on the presentation laptop.
- [ ] Keep a copy on the laptop and in the team drive; do not rely on Wi-Fi.

## If you cannot record

Use the deck slides 4–8 and the screenshots in the morning pack. Say: "The live demo runs on localhost; here is the recorded path and the test results." Do not debug live.
