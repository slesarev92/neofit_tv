'use strict';
// "Later today" (demo only): up to 6 classes after the next-hour window, departure-board rows.

const { esc } = require('../lib/text');
const { page, brand } = require('../lib/layout');
const { laterToday, hhmm, whenLabel } = require('../lib/schedule');

const CSS = `
body { background: #0c0d0b; }
.head { position: absolute; left: 96px; top: 54px; right: 96px; display: flex; align-items: baseline; gap: 30px; }
.head .when { font: 700 44px 'Manrope'; color: var(--green); }
.head .h1 { font-size: 92px; }
.rows { position: absolute; left: 96px; right: 96px; top: 200px; border-top: 4px solid var(--green); }
.r { display: grid; grid-template-columns: 340px 1fr 520px; align-items: center; height: 128px;
  border-bottom: 2px solid #23271f; }
.tm { font: 900 76px 'Unbounded'; color: var(--green); }
.ttl { font: 800 60px/1.05 'Manrope'; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 24px; }
.who { font: 700 48px/1.1 'Manrope'; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

module.exports = function laterSlide(classes, now, day) {
  const items = laterToday(classes, now);
  if (!items.length) return null;
  return page(CSS, `
<div class="head"><div class="h1">Сегодня позже</div>${day ? `<div class="when">${esc(whenLabel(day, now))}</div>` : ''}</div>
<div class="rows">${items.map(c => `<div class="r"><div class="tm">${hhmm(c)}</div>
  <div class="ttl">${esc(c.title)}</div><div class="who">${esc(String(c.room || '').trim())}</div></div>`).join('')}</div>
${brand('bottom')}`);
};
