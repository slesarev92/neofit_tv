'use strict';
// Team wall: every trainer with a photo as a portrait tile, grouped by direction.

const { esc } = require('../lib/text');
const { page, brand, DIRECTION } = require('../lib/layout');

const ORDER = ['Тренажёрный зал', 'Групповые программы', 'Бассейн', 'Единоборства'];

const CSS = `
.head { position: absolute; left: 80px; top: 64px; }
.head .h1 { margin-top: 18px; }
.grid { position: absolute; left: 80px; right: 80px; top: 270px; bottom: 60px; display: grid;
  grid-template-columns: repeat(8, 1fr); grid-auto-rows: 1fr; gap: 14px; }
.cell { position: relative; overflow: hidden; background: radial-gradient(circle at 50% 30%, #182010, #090b07 70%);
  border-bottom: 4px solid var(--green); }
.cell img { position: absolute; left: 50%; top: 6px; width: 120%; transform: translateX(-50%); }
.cell .cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 10px 10px;
  background: linear-gradient(0deg, rgba(0,0,0,.95) 35%, transparent); text-align: center; }
.cell .n { font: 800 19px/1.1 'Manrope'; }
.cell .d { font: 600 14px 'Manrope'; color: var(--green); margin-top: 3px; text-transform: uppercase;
  letter-spacing: .06em; }
`;

module.exports = function teamSlide(trainers) {
  const rank = t => ORDER.indexOf(DIRECTION[t.position]);
  const list = trainers.filter(t => t.photo).sort((a, b) => rank(a) - rank(b));
  return page(CSS, `
<div class="head"><div class="kicker">${list.length} тренеров</div><div class="h1">Наша команда</div></div>
<div class="grid">${list.map(t => `<div class="cell"><img class="cutout" src="../${esc(t.photo)}">
  <div class="cap"><div class="n">${esc(t.name)}</div><div class="d">${esc(DIRECTION[t.position] || '')}</div></div></div>`).join('')}</div>
${brand()}`);
};
