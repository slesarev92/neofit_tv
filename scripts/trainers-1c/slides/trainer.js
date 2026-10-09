'use strict';
// Trainer card: cut-out photo left, name, experience, specialization chips, one achievement.

const { esc, theses, yearsWord } = require('../lib/text');
const { page, brand, POSITION_LABELS } = require('../lib/layout');

const CSS = `
.glow.a { left: -260px; top: 60px; width: 1300px; height: 1300px; }
.ring { position: absolute; left: 110px; top: 150px; width: 700px; height: 700px; border-radius: 50%;
  border: 3px solid rgba(141,198,63,.35); }
.disc { position: absolute; left: 170px; top: 210px; width: 580px; height: 580px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #1b2410 0%, #0b0f07 70%); }
.photo { position: absolute; left: 60px; bottom: 0; height: 1030px; }
.fade { position: absolute; left: 0; bottom: 0; width: 960px; height: 180px;
  background: linear-gradient(0deg, var(--bg) 10%, transparent); }
.info { position: absolute; left: 960px; top: 150px; width: 880px; bottom: 70px; display: flex;
  flex-direction: column; }
.info > * { flex: none; }
.name { margin-top: 26px; font: 900 112px/1 'Unbounded'; text-transform: uppercase; white-space: nowrap;
  overflow: hidden; }
.name.first { color: var(--green); margin-top: 6px; }
.stat { display: flex; align-items: center; gap: 22px; margin-top: 46px; }
.num { font: 900 128px/0.9 'Unbounded'; }
.unit { font: 700 32px/1.15 'Manrope'; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.chips { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 44px; }
.chip { font: 700 30px/1 'Manrope'; padding: 16px 26px; border-radius: 999px; background: var(--green-dim);
  border: 2px solid rgba(141,198,63,.45); white-space: nowrap; }
.chips { margin-bottom: 40px; }
.award { margin-top: auto; display: flex; gap: 22px; align-items: flex-start; padding: 24px 28px;
  background: var(--panel); border-left: 6px solid var(--green); }
.award .star { font: 900 40px/1 'Unbounded'; color: var(--green); }
.award .txt { font: 600 28px/1.3 'Manrope'; color: #d8dad3; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; }
`;

module.exports = function trainerSlide(t) {
  const th = theses(t);
  const [surname, ...rest] = t.name.split(' ');
  const award = th.topAward || th.awards[0];
  return page(CSS, `
<div class="glow a"></div><div class="ring"></div><div class="disc"></div>
<img class="photo cutout" src="../${esc(t.photo)}"><div class="fade"></div>
<div class="info">
  <div class="kicker">${esc(POSITION_LABELS[t.position] || t.position)}</div>
  <div class="name" data-fit>${esc(surname)}</div>
  <div class="name first" data-fit>${esc(rest.join(' '))}</div>
  ${th.years ? `<div class="stat"><span class="num">${th.years}</span><span class="unit">${yearsWord(th.years)}<br>опыта</span></div>` : ''}
  ${th.specs.length ? `<div class="chips">${th.specs.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
  ${award ? `<div class="award"><span class="star">★</span><span class="txt">${esc(award)}</span></div>` : ''}
</div>
${brand()}`);
};
