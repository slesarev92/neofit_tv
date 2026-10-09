# Trainer & schedule screens v3 — design

Status: approved in brainstorm 2026-10-10. Research basis: `docs/trainers-1c-research.md`. Journal: `docs/trainers-1c.md`.

## Goal

Auto-generated slides from 1C:Fitness for ~34″ TVs in NeoFit Krylatskoe gym zones, viewed from 2–3 m, glanced at between sets. Test stage: static 1920×1080 JPEGs in a normal playlist on the test screen. Panel integration is stage 2.

## Content (only two kinds)

1. **Trainer card** — one slide per trainer, never split:
   - cut-out studio photo, position plate, surname + first name (≥112 px), years of experience as a large numeral, two main specializations (56–60 px);
   - booking line «Запись — на ресепшене или в приложении NeoFit» + small QR (demo; URL placeholder `https://k.n-fit.ru/offer/?link=trainers` until the club provides a booking link).
   - Trainers without a photo are not shown.
2. **Next hour** — classes starting in [now − 10 min, now + 60 min], max 4, ordered by time; a class that has started gets an «идёт» tag; times are absolute («18:00»). If the window is empty, show the single nearest upcoming class under the title «Следующее занятие». Trainers without a photo get an initials circle.
3. **Later today** — demo only, not part of the production loop: up to 6 classes after the next-hour window.

Filtered out everywhere: room bookings («Зал забронирован»), placeholder staff (single-word employee name), cancelled classes.

Removed from v2: team wall, team in numbers, achievement slide, full-day schedule.

## Visual direction: «Эфир» (broadcast)

Black background, lime #8dc63f accent, Unbounded (display) + Manrope (text), weights ≥600.
- Card: giant outlined surname behind the figure, slanted lime plate with the position, stacked name (white surname, lime first name), large years numeral, specializations with a lime left bar, QR + booking line at the bottom right.
- Next hour: slanted lime time plate + dark slanted body (class 66 px; room · trainer 46 px) + round trainer photo/initials.
- Later today: departure-board rows (time 76 px, class 60 px, room 48 px).
- Safe area 96 px sides / 54 px top-bottom; brand «NEOFIT · КРЫЛАТСКОЕ» top right.

## Loop

Production (stage 2): next hour → trainer → trainer → next hour → trainer; trainer ~10 s, schedule ~12 s, ≈1 min per cycle; 3 trainers per day, rotating through all over ~8 days.
Demo (now): one cycle of that loop with today's 3 trainers + the later-today slide, 3 s per slide (the user asked for a fast demo).

## Data & load

`fetch.js` once per run: `/trainers` + `/employee` per id + `/classes` for the day + photos (~65 GETs). Stage 2: trainers/photos nightly, `/classes` every 15 min, last good snapshot on failure, no retry loops.

## Stage 2 requirements (not built now)

- Next-hour slide must be regenerated at least every 15 min (otherwise it shows past classes).
- Daily trainer rotation state; per-club config (1C credentials in server `.env`, separate read-only 1C user instead of `admin`).
- Publishing without stopping the app (admin API or a server-side job inside the running process).

## Open questions

- Kids' room classes («Детская комната») on gym-floor screens — keep or filter? Currently kept.
- Real booking URL for the QR.
- Trainers without photos (4 of 28).

## Testing

Render, inspect every slide visually (overflow, overlaps, ≥ size floors), view in the real player via the test screen; final check on a real TV from 2–3 m.
