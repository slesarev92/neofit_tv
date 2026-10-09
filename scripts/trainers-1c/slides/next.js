'use strict';
// "Coming up": the next three classes led by trainers with photos, as large tiles.

const { esc } = require('../lib/text');
const { page, brand } = require('../lib/layout');
const { rowsFor } = require('./today');

const CSS = `
.head { position: absolute; left: 80px; top: 64px; }
.head .h1 { margin-top: 18px; }
.tiles { position: absolute; left: 80px; right: 80px; top: 280px; bottom: 70px; display: grid;
  grid-template-columns: repeat(3, 1fr); gap: 36px; }
.tile { position: relative; overflow: hidden; background: var(--panel); border: 1px solid var(--line); }
.tile.first { border: 3px solid var(--green); }
.tile .bg { position: absolute; left: 0; right: 0; top: 0; height: 460px;
  background: radial-gradient(circle at 50% 70%, #1c2611 0%, transparent 70%); }
.tile img { position: absolute; left: 50%; top: 24px; height: 420px; transform: translateX(-50%); }
.tile .shade { position: absolute; left: 0; right: 0; top: 290px; height: 170px;
  background: linear-gradient(0deg, var(--panel) 18%, transparent); }
.tile .body { position: absolute; left: 36px; right: 36px; bottom: 34px; }
.time { font: 900 84px/1 'Unbounded'; color: var(--green); }
.title { margin-top: 14px; font: 800 42px/1.08 'Manrope'; height: 92px; overflow: hidden; }
.meta { margin-top: 14px; font: 600 26px/1.3 'Manrope'; color: var(--muted); }
.meta b { color: var(--text); font-weight: 700; }
.badge { position: absolute; top: 24px; left: 24px; font: 800 20px 'Unbounded'; letter-spacing: .12em;
  background: var(--green); color: #000; padding: 10px 16px; }
`;

module.exports = function nextSlide(day, classes, trainers, now) {
  const byId = new Map(trainers.map(t => [t.id, t]));
  const seen = new Set();
  const upcoming = rowsFor(classes)
    .filter(c => c.start.slice(11, 16) >= now)
    .filter(c => byId.get(c.employeeId) && byId.get(c.employeeId).photo)
    .filter(c => !seen.has(c.employeeId) && seen.add(c.employeeId)) // three different faces
    .slice(0, 3);
  if (upcoming.length < 3) return null;

  const tile = (c, i) => {
    const t = byId.get(c.employeeId);
    return `<div class="tile ${i === 0 ? 'first' : ''}"><div class="bg"></div>
      <img class="cutout" src="../${esc(t.photo)}"><div class="shade"></div>
      ${i === 0 ? '<div class="badge">ДАЛЕЕ</div>' : ''}
      <div class="body"><div class="time">${esc(c.start.slice(11, 16))}</div>
        <div class="title">${esc(c.title)}</div>
        <div class="meta"><b>${esc(t.name)}</b><br>${esc(String(c.room || '').trim())}</div></div></div>`;
  };

  return page(CSS, `
<div class="head"><div class="kicker">Расписание</div><div class="h1">Скоро в клубе</div></div>
<div class="tiles">${upcoming.map(tile).join('')}</div>
${brand()}`);
};
