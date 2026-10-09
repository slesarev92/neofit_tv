# Trainer & Schedule Screens v3 (test stage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the v3 «Эфир» slide set (trainer cards, next hour, later today) and publish a 3-second demo loop to the test screen.

**Architecture:** Offline generator in `scripts/trainers-1c/`: `fetch.js` (1C → `out/*.json`), slide templates `slides/{card,hour,later}.js` built on `lib/{text,layout,schedule,shoot}.js`, orchestrator `render.js` → `out/slides/` + `out/slides/demo/`. Publishing via `server-publish.js` run on the server while the app is stopped.

**Tech Stack:** Node 20+/24 (CommonJS), `node:test`, headless Chrome, sharp (already a dependency).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-10-trainers-screens-v3-design.md`.
- Filter out everywhere: «Зал забронирован», single-word employee names, cancelled classes, room or course «Детская комната».
- Next-hour window: start in [now − 10 min, now + 60 min], max 4; empty → single nearest upcoming class.
- Demo loop: hour → trainer → trainer → hour → trainer → later, 3 s each, playlist `TEST-TRAINERS-DEMO`, screen `1c46f426-d132-4769-b6ab-bbc3f9b6d706`.
- No new npm dependencies. Secrets only in `.env` (`FIT1C_*`). `out/` is gitignored (names/photos).
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Kids' classes filter (TDD)

**Files:**
- Modify: `scripts/trainers-1c/lib/schedule.js` (`realClasses`)
- Create: `scripts/trainers-1c/lib/schedule.test.js`

**Interfaces:**
- Produces: `nextHour(classes, now) → {mode: 'hour'|'next', items}`, `laterToday(classes, now, limit=6) → items` — unchanged signatures; kids' classes excluded.

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { nextHour, laterToday } = require('./schedule');

const cls = (start, title, room, employeeName = 'Иванов Иван', extra = {}) =>
  ({ start: `2026-10-10 ${start}:00`, title, room, course: null, employeeName, canceled: false, ...extra });

test('next hour excludes kids room, bookings and placeholder staff', () => {
  const classes = [
    cls('13:00', 'Плавание', 'Бассейн'),
    cls('13:00', 'Квилинг', 'Детская комната'),
    cls('13:00', 'Йога', 'Зал', 'Иванов Иван', { course: 'Детская комната' }),
    cls('13:10', 'Зал забронирован', 'Зал Энергия'),
    cls('13:20', 'Стретчинг', 'Зал Энергия', 'Инструктор '),
  ];
  const sel = nextHour(classes, '12:50');
  assert.strictEqual(sel.mode, 'hour');
  assert.deepStrictEqual(sel.items.map(c => c.title), ['Плавание']);
});

test('empty window falls back to the nearest upcoming class', () => {
  const sel = nextHour([cls('18:00', 'Тай бо', 'Зал Энергия')], '15:00');
  assert.strictEqual(sel.mode, 'next');
  assert.strictEqual(sel.items[0].title, 'Тай бо');
});

test('later today starts after the window and skips kids room', () => {
  const items = laterToday([
    cls('13:30', 'Рано', 'Зал'), cls('14:00', 'Аппликация', 'Детская комната'), cls('14:00', 'Бачата', 'Зал'),
  ], '12:50');
  assert.deepStrictEqual(items.map(c => c.title), ['Бачата']);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test scripts/trainers-1c/lib/schedule.test.js`
Expected: FAIL in tests 1 and 3 (kids classes present).

- [ ] **Step 3: Implement** — in `realClasses` add:

```js
const KIDS = /детская комната/i;
// ...
    .filter(c => !KIDS.test(String(c.room || '')) && !KIDS.test(String(c.course || '')))
```

- [ ] **Step 4: Run tests** — `node --test scripts/trainers-1c/lib/schedule.test.js` → 3 pass.
- [ ] **Step 5: Commit** — `feat(trainers-1c): drop kids' room classes from schedule slides`.

### Task 2: Switch render.js to v3, remove v2 modules

**Files:**
- Modify: `scripts/trainers-1c/render.js` (rewrite)
- Delete: `scripts/trainers-1c/slides/{trainer,achievement,next,today,team,stats}.js`
- Modify: `scripts/trainers-1c/mockups.js` (unchanged API; keep working)

**Interfaces:**
- Consumes: `cardSlide(t, 'broadcast', qrUrl)`, `hourSlide(classes, trainers, now, 'broadcast')`, `laterSlide(classes, now)`, `shoot(htmlFile, jpgFile)`.
- Produces: `out/slides/card-NN.jpg` (every trainer with photo), `out/slides/hour.jpg`, `out/slides/later.jpg`, `out/slides/demo/{1..6}-*.jpg` in loop order.

- [ ] **Step 1: Rewrite render.js**

```js
#!/usr/bin/env node
// Renders v3 «Эфир» slides from out/trainers.json + out/classes.json.
// Usage: node scripts/trainers-1c/render.js [--now=HH:MM] [--day-trainers=Surname1,Surname2,Surname3]
// Output: out/slides/*.jpg (all cards + schedule) and out/slides/demo/*.jpg (one loop, show order).
'use strict';

const fs = require('fs');
const path = require('path');
const { shoot } = require('./lib/shoot');
const { theses } = require('./lib/text');
const cardSlide = require('./slides/card');
const hourSlide = require('./slides/hour');
const laterSlide = require('./slides/later');

const OUT = path.join(__dirname, 'out');
const HTML = path.join(OUT, 'html');
const SLIDES = path.join(OUT, 'slides');
const DEMO = path.join(SLIDES, 'demo');
const QR_URL = 'https://k.n-fit.ru/offer/?link=trainers'; // placeholder until the club gives a booking link
const STYLE = 'broadcast';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];

// Demo stand-in for daily rotation: the three richest cards (years + specializations).
function pickDay(trainers, names) {
  if (names) return names.split(',').map(n => trainers.find(t => t.name.startsWith(n))).filter(Boolean);
  const score = t => { const th = theses(t); return (th.years ? 2 : 0) + Math.min(th.specs.length, 2); };
  return [...trainers].sort((a, b) => score(b) - score(a)).slice(0, 3);
}

async function main() {
  const now = arg('now', '12:50');
  const trainers = require(path.join(OUT, 'trainers.json')).filter(t => t.photo);
  const { classes } = require(path.join(OUT, 'classes.json'));
  for (const d of [HTML, SLIDES]) fs.rmSync(d, { recursive: true, force: true });
  for (const d of [HTML, SLIDES, DEMO]) fs.mkdirSync(d, { recursive: true });

  const jobs = trainers.map((t, i) => [`card-${String(i + 1).padStart(2, '0')}`, cardSlide(t, STYLE, QR_URL), t]);
  const hour = hourSlide(classes, trainers, now, STYLE);
  if (hour) jobs.push(['hour', hour]);
  const later = laterSlide(classes, now);
  if (later) jobs.push(['later', later]);

  for (const [name, html] of jobs) {
    const file = path.join(HTML, `${name}.html`);
    fs.writeFileSync(file, html);
    await shoot(file, path.join(SLIDES, `${name}.jpg`));
    process.stdout.write('.');
  }

  const cardOf = t => jobs.find(j => j[2] === t)[0];
  const [a, b, c] = pickDay(trainers, arg('day-trainers', ''));
  const loop = [hour && 'hour', cardOf(a), cardOf(b), hour && 'hour', cardOf(c), later && 'later'].filter(Boolean);
  loop.forEach((name, i) => fs.copyFileSync(path.join(SLIDES, `${name}.jpg`), path.join(DEMO, `${i + 1}-${name}.jpg`)));
  console.log(`\n${jobs.length} slides; demo loop: ${loop.join(' → ')}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
```

- [ ] **Step 2: Delete v2 modules** — `git rm scripts/trainers-1c/slides/{trainer,achievement,next,today,team,stats}.js`; `grep -rn "slides/\(trainer\|achievement\|next\|today\|team\|stats\)" scripts/trainers-1c` → no hits.
- [ ] **Step 3: Run** — `node scripts/trainers-1c/render.js` → 24 cards + hour + later, demo loop of 6.
- [ ] **Step 4: Visual check** — build a contact sheet of all cards and open hour/later/demo; check no overlap, no clipping of long surnames/specializations, kids' classes absent. Fix CSS in `slides/card.js` / `slides/hour.js` if any card breaks.
- [ ] **Step 5: Commit** — `feat(trainers-1c): render v3 broadcast set and demo loop, drop v2 slides`.

### Task 3: Publish demo and record

**Files:**
- Modify: `docs/trainers-1c.md`, `GO.md`

- [ ] **Step 1: Upload** (retry loop, server by IP `5.35.91.125`, `-o HostKeyAlias=tv.n-fit.ru`): clear `/tmp/trainers-v3/slides`, scp `out/slides/demo/*.jpg` and `server-publish.js`.
- [ ] **Step 2: Run detached** `run.sh`: backup `data/*.json` → `pm2 stop signage` → `node server-publish.js /tmp/trainers-v3/slides TEST-TRAINERS-DEMO 3 1c46f426-d132-4769-b6ab-bbc3f9b6d706` → `pm2 start signage`; via `nohup`.
- [ ] **Step 3: Verify** — run.log has `created:false` and `DONE`; `pm2` online; `curl localhost:3000/api/player/<screenId>` → 6 items, durations all 3; nginx `/api/player/` back to 200; headless Chrome screenshot of the player URL shows a v3 slide.
- [ ] **Step 4: Journal + GO.md** — record v3 publish (playlist id, backup path, downtime), push.
