'use strict';
// Achievement hero: one title-grade achievement as a headline, photo on the right.

const { esc, theses } = require('../lib/text');
const { page, brand, POSITION_LABELS } = require('../lib/layout');

const CSS = `
.glow.a { right: -300px; top: -40px; width: 1300px; height: 1300px; }
.slab { position: absolute; right: -40px; top: 0; width: 90px; height: 1080px; background: var(--green);
  transform: skewX(-10deg); }
.slab.thin { right: 90px; width: 22px; opacity: .45; }
.disc { position: absolute; right: 170px; top: 170px; width: 680px; height: 680px; border-radius: 50%;
  background: radial-gradient(circle at 45% 40%, #22301a 0%, #0b0f07 68%); box-shadow: 0 0 0 3px rgba(141,198,63,.35); }
.fade { position: absolute; right: 0; bottom: 0; width: 1000px; height: 160px;
  background: linear-gradient(0deg, var(--bg) 10%, transparent); }
.photo { position: absolute; right: 130px; bottom: 0; height: 1020px; }
.text { position: absolute; left: 100px; top: 170px; width: 980px; bottom: 120px; display: flex;
  flex-direction: column; }
.text > * { flex: none; }
.quote { margin-top: 40px; font: 900 200px/1 'Unbounded'; color: var(--green); height: 110px; overflow: hidden; }
.headline { margin-top: 20px; font: 800 80px/1.08 'Manrope'; letter-spacing: -.01em; height: 440px;
  overflow: hidden; }
.who { margin-top: auto; }
.who .name { font: 800 52px/1.1 'Unbounded'; text-transform: uppercase; }
.who .pos { margin-top: 12px; font: 600 30px 'Manrope'; color: var(--muted); }
`;

module.exports = function achievementSlide(t) {
  const th = theses(t);
  return page(CSS, `
<div class="glow a"></div><div class="disc"></div><div class="slab"></div><div class="slab thin"></div>
<img class="photo cutout" src="../${esc(t.photo)}"><div class="fade"></div>
<div class="text">
  <div class="kicker">Достижения тренера</div>
  <div class="quote">“</div>
  <div class="headline" data-fit="52" data-fit-h>${esc(th.topAward)}</div>
  <div class="who"><div class="name">${esc(t.name)}</div>
    <div class="pos">${esc(POSITION_LABELS[t.position] || t.position)}</div></div>
</div>
${brand('left')}`);
};
