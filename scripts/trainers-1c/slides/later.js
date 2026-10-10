'use strict';
// "Later today" (demo only): up to 6 classes after the "next classes" slide, departure-board rows.

const { esc, plural } = require('../lib/text');
const { page, brand } = require('../lib/layout');
const { laterToday, seatsLeft, hhmm, whenLabel } = require('../lib/schedule');

const CSS = `
body { background: #0c0d0b; }
.head { position: absolute; left: 96px; top: 54px; right: 260px; display: flex; align-items: baseline; gap: 30px; }
.head .when { font: 700 44px 'Manrope'; color: var(--green); }
.head .h1 { font-size: 92px; }
.rows { position: absolute; left: 96px; right: 96px; top: 200px; border-top: 4px solid var(--green); }
.r { display: grid; grid-template-columns: 340px 1fr 380px 260px; align-items: center; height: 128px;
  border-bottom: 2px solid #23271f; }
.tm { font: 900 76px 'Unbounded'; color: var(--green); }
.ttl { font: 800 60px/1.05 'Manrope'; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 24px; }
.who { font: 700 48px/1.1 'Manrope'; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.seats { text-align: right; font: 900 60px 'Unbounded'; color: var(--green); white-space: nowrap; }
.seats i { font: 800 34px 'Manrope'; font-style: normal; margin-left: 10px; color: var(--text); }
.seats.full { font: 800 32px 'Unbounded'; text-transform: uppercase; color: var(--muted); }
`;

// Seats left at the row end; empty cell for classes without booking.
function seats(c) {
  const n = seatsLeft(c);
  if (n === null) return '<div></div>';
  if (n === 0) return '<div class="seats full">мест нет</div>';
  return `<div class="seats">${n}<i>${plural(n, 'место', 'места', 'мест')}</i></div>`;
}

module.exports = function laterSlide(classes, now, day) {
  const items = laterToday(classes, now);
  if (!items.length) return null;
  return page(CSS, `
<div class="head"><div class="h1">Сегодня позже</div>${day ? `<div class="when">${esc(whenLabel(day, now))}</div>` : ''}</div>
<div class="rows">${items.map(c => `<div class="r"><div class="tm">${hhmm(c)}</div>
  <div class="ttl" data-fit="46">${esc(c.title)}</div><div class="who">${esc(String(c.room || '').trim())}</div>${seats(c)}</div>`).join('')}</div>
${brand()}`);
};
