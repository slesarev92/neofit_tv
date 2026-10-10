'use strict';
// Trainer card v3: photo, big name, years + two specializations, booking line with a small QR.
// Sized for 34" TVs viewed from 2–3 m: body ≥52 px, key text ≥72 px. Three visual directions.

const { esc, theses, yearsWord, clip } = require('../lib/text');
const { page, brand, ASSETS, POSITION_LABELS } = require('../lib/layout');

const BOOKING = 'Запись — на ресепшене<br>или в приложении NeoFit';
const QR_LIB = `${ASSETS}/qrcode.min.js`; // qrcode-generator 1.4.4 (MIT), vendored

// Renders a QR into every [data-qr] element: black modules on the NeoFit green, quiet zone included
// (dark-on-light keeps it readable for every phone camera; inverted codes fail on some).
const qrScript = url => `<script src="${QR_LIB}"></script><script>
document.querySelectorAll('[data-qr]').forEach(el => {
  const q = qrcode(0, 'M'); q.addData(${JSON.stringify(url)}); q.make();
  el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }).replace(/fill="white"/g, 'fill="#8dc63f"');
});
</script>`;

// Specializations that fit one line, shown two at a time: short items first, generic "Инструктор …" skipped.
// Up to two pairs; on video slides the second pair replaces the first halfway through.
const SPEC_MAX = 24;
function facts(t) {
  const th = theses(t);
  const useful = th.specsAll.filter(s => !/^инструктор/i.test(s));
  const pool = useful.length ? useful : th.specsAll;
  const ordered = [...pool.filter(s => s.length <= SPEC_MAX), ...pool.filter(s => s.length > SPEC_MAX)];
  const short = ordered.filter(s => s.length <= SPEC_MAX);
  const specs = (short.length > 2 ? short.slice(0, 4) : ordered.slice(0, 2)).map(s => clip(s, SPEC_MAX));
  return { years: th.years, specs: specs.slice(0, 2), specsNext: specs.slice(2, 4) };
}

const CSS_COMMON = `
.qr { width: 116px; height: 116px; background: var(--green); flex: none; }
.qr svg { width: 100%; height: 100%; display: block; }
.book { display: flex; align-items: center; gap: 28px; }
.book .txt { font: 700 40px/1.2 'Manrope'; color: var(--text); }
`;

const specSet = (list, cls) => `<div class="set ${cls}">${list.map(s => `<div>${esc(s)}</div>`).join('')}</div>`;

// 1. Broadcast: giant outlined surname behind a cut-out figure, slanted plates.
function broadcast(t, f, qrUrl) {
  const [surname, ...rest] = t.name.split(' ');
  return page(CSS_COMMON + `
.ghost { position: absolute; left: -20px; top: 40px; font: 900 340px/1 'Unbounded'; text-transform: uppercase;
  color: transparent; -webkit-text-stroke: 3px rgba(141,198,63,.28); white-space: nowrap; }
.glow.a { left: 120px; top: 120px; width: 1100px; height: 1100px; }
.photo { position: absolute; left: 150px; bottom: 0; height: 1000px; }
.fade { position: absolute; left: 0; bottom: 0; width: 1100px; height: 140px; background: linear-gradient(0deg, var(--bg), transparent); }
.panel { position: absolute; right: 96px; top: 156px; width: 820px; }
.plate { display: inline-block; background: var(--green); color: #000; padding: 14px 34px 12px 28px;
  transform: skewX(-12deg); margin-left: 12px; }
.plate > span { display: inline-block; transform: skewX(12deg); font: 800 30px 'Unbounded'; letter-spacing: .1em; text-transform: uppercase; }
.name { margin-top: 26px; font: 900 112px/0.98 'Unbounded'; text-transform: uppercase; white-space: nowrap; overflow: hidden; }
.name.first { color: var(--green); }
.stat { margin-top: 34px; display: flex; align-items: flex-end; gap: 24px; }
.stat .n { font: 900 170px/0.8 'Unbounded'; }
.stat .u { font: 800 52px/1.05 'Manrope'; color: var(--muted); padding-bottom: 6px; }
.specs { position: relative; margin-top: 36px; height: 124px; }
.specs .set { position: absolute; left: 0; right: 0; top: 0; display: flex; flex-direction: column; gap: 10px; }
.specs .set.a.swap { animation: spec-out 5s linear both; }
.specs .set.b { animation: spec-in 5s linear both; }
@keyframes spec-out { 0%, 42% { opacity: 1; transform: none; } 48%, 100% { opacity: 0; transform: translateY(-24px); } }
@keyframes spec-in { 0%, 50% { opacity: 0; transform: translateY(24px); } 56%, 100% { opacity: 1; transform: none; } }
.specs .set div { font: 800 52px/1.1 'Manrope'; padding-left: 34px; border-left: 10px solid var(--green);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.book { position: absolute; right: 96px; bottom: 54px; width: 820px; }
`, `
<div class="ghost">${esc(surname)}</div><div class="glow a"></div>
<img class="photo cutout" src="../${esc(t.photo)}"><div class="fade"></div>
<div class="panel">
  <div class="plate"><span>${esc(POSITION_LABELS[t.position] || t.position)}</span></div>
  <div class="name" data-fit="80">${esc(surname)}</div><div class="name first" data-fit="80">${esc(rest.join(' '))}</div>
  ${f.years ? `<div class="stat"><span class="n">${f.years}</span><span class="u">${yearsWord(f.years)}<br>опыта</span></div>` : ''}
  <div class="specs">${specSet(f.specs, f.specsNext.length ? 'a swap' : 'a')}${f.specsNext.length ? specSet(f.specsNext, 'b') : ''}</div>
</div>
<div class="book"><div class="qr" data-qr></div><div class="txt">${BOOKING}</div></div>
${brand()}${qrScript(qrUrl)}`);
}

// 2. Board: strict grid, photo in a framed column, facts as labelled rows.
function board(t, f, qrUrl) {
  return page(CSS_COMMON + `
body { background: #0c0d0b; }
.col { position: absolute; left: 96px; top: 54px; bottom: 54px; width: 700px; background: #000; overflow: hidden;
  border-top: 10px solid var(--green); }
.col img { position: absolute; left: 50%; bottom: 0; height: 960px; transform: translateX(-50%); }
.right { position: absolute; left: 870px; right: 96px; top: 54px; bottom: 54px; display: flex; flex-direction: column; }
.right > * { flex: none; }
.kicker { font-size: 34px; }
.name { margin-top: 20px; font: 900 112px/1 'Unbounded'; text-transform: uppercase; white-space: nowrap; overflow: hidden; }
.row { margin-top: 40px; display: grid; grid-template-columns: 300px 1fr; align-items: baseline;
  border-top: 2px solid #2a2e25; padding-top: 22px; }
.row .k { font: 700 36px 'Manrope'; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.row .v { font: 800 72px/1.1 'Manrope'; }
.row .v.big { font: 900 150px/0.9 'Unbounded'; color: var(--green); }
.row .v small { font: 800 56px 'Manrope'; color: var(--text); margin-left: 16px; }
.book { margin-top: auto; background: #000; padding: 26px; border-left: 10px solid var(--green); }
`, `
<div class="col"><img class="cutout" src="../${esc(t.photo)}"></div>
<div class="right">
  <div class="kicker">${esc(POSITION_LABELS[t.position] || t.position)}</div>
  <div class="name" data-fit="72">${esc(t.name)}</div>
  ${f.years ? `<div class="row"><div class="k">Опыт</div><div class="v big">${f.years}<small>${yearsWord(f.years)}</small></div></div>` : ''}
  <div class="row"><div class="k">Помогу с</div><div class="v">${f.specs.map(esc).join('<br>')}</div></div>
  <div class="book"><div class="qr" data-qr></div><div class="txt">${BOOKING}</div></div>
</div>
${qrScript(qrUrl)}`);
}

// 3. Poster: photo dominates the right half, a few huge words on the left.
function poster(t, f, qrUrl) {
  const [surname, ...rest] = t.name.split(' ');
  return page(CSS_COMMON + `
.half { position: absolute; right: 0; top: 0; width: 960px; height: 1080px;
  background: radial-gradient(circle at 50% 45%, #2a3a17 0%, #0b0f07 60%, #000 80%); }
.half img { position: absolute; left: 50%; bottom: 0; height: 1080px; transform: translateX(-50%); }
.left { position: absolute; left: 96px; top: 54px; bottom: 54px; width: 900px; display: flex; flex-direction: column; }
.left > * { flex: none; }
.first { margin-top: 60px; font: 800 72px/1 'Manrope'; color: var(--green); }
.name { margin-top: 8px; font: 900 136px/0.95 'Unbounded'; text-transform: uppercase; white-space: nowrap; overflow: hidden; }
.years { margin-top: 48px; font: 800 72px/1 'Manrope'; }
.years b { font: 900 72px 'Unbounded'; color: var(--green); }
.specs { margin-top: 28px; font: 700 60px/1.25 'Manrope'; color: #d8dad3; }
.book { margin-top: auto; }
`, `
<div class="half"><img class="cutout" src="../${esc(t.photo)}"></div>
<div class="left">
  <div class="first">${esc(rest.join(' '))}</div>
  <div class="name" data-fit="80">${esc(surname)}</div>
  ${f.years ? `<div class="years"><b>${f.years}</b> ${yearsWord(f.years)} опыта</div>` : ''}
  <div class="specs">${f.specs.map(esc).join(' · ')}</div>
  <div class="book"><div class="qr" data-qr></div><div class="txt">${BOOKING}</div></div>
</div>
${brand()}${qrScript(qrUrl)}`);
}

const VARIANTS = { broadcast, board, poster };

module.exports = function cardSlide(t, variant, qrUrl) {
  return VARIANTS[variant](t, facts(t), qrUrl);
};
module.exports.VARIANTS = Object.keys(VARIANTS);
