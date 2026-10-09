'use strict';
// Team in numbers: counts derived from 1C data, plus a strip of faces.

const { esc, theses, plural } = require('../lib/text');
const { page, brand, DIRECTION } = require('../lib/layout');

const CSS = `
.glow.a { left: 50%; top: 40%; width: 1600px; height: 1600px; transform: translate(-50%, -50%); }
.head { position: absolute; left: 80px; top: 64px; }
.head .h1 { margin-top: 18px; }
.nums { position: absolute; left: 80px; right: 80px; top: 300px; display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 40px; }
.n { border-top: 6px solid var(--green); padding-top: 28px; }
.n .v { font: 900 180px/0.9 'Unbounded'; }
.n .l { margin-top: 18px; font: 700 34px/1.2 'Manrope'; color: #d8dad3; }
.dirs { position: absolute; left: 80px; right: 80px; top: 690px; display: flex; gap: 18px; flex-wrap: wrap; }
.dir { font: 700 28px 'Manrope'; padding: 14px 24px; border-radius: 999px; background: var(--green-dim);
  border: 2px solid rgba(141,198,63,.45); }
.dir b { color: var(--green); font-family: 'Unbounded'; margin-right: 10px; }
.faces { position: absolute; left: 80px; right: 80px; bottom: 60px; display: flex; }
.faces img { width: 132px; height: 132px; border-radius: 50%; object-fit: cover; object-position: 50% 10%;
  border: 4px solid #000; margin-right: -62px; background: #151a10; }
`;

module.exports = function statsSlide(trainers) {
  const list = trainers.filter(t => t.photo);
  const th = list.map(theses);
  const years = th.reduce((s, x) => s + (x.years || 0), 0);
  const titled = th.filter(x => x.hasSportsTitle).length;
  const dirs = {};
  list.forEach(t => { const d = DIRECTION[t.position]; if (d) dirs[d] = (dirs[d] || 0) + 1; });

  return page(CSS, `
<div class="glow a"></div>
<div class="head"><div class="kicker">NeoFit Крылатское</div><div class="h1">Команда в цифрах</div></div>
<div class="nums">
  <div class="n"><div class="v">${list.length}</div><div class="l">${plural(list.length, 'тренер', 'тренера', 'тренеров')}<br>в команде</div></div>
  <div class="n"><div class="v">${years}</div><div class="l">${plural(years, 'год', 'года', 'лет')} опыта<br>на всех</div></div>
  <div class="n"><div class="v">${titled}</div><div class="l">мастера спорта и КМС<br>среди тренеров</div></div>
</div>
<div class="dirs">${Object.entries(dirs).sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `<div class="dir"><b>${n}</b>${esc(d)}</div>`).join('')}</div>
<div class="faces">${list.map(t => `<img src="../${esc(t.photo)}">`).join('')}</div>
${brand()}`);
};
