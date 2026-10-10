'use strict';
// "Next classes": the four nearest classes that have not started yet, 1–4 large items.
// Sized for 2–3 m: time ≥110 px, class ≥64 px, room/trainer ≥48 px. Three visual directions.

const { esc, plural } = require('../lib/text');
const { page, brand } = require('../lib/layout');
const { nextClasses, seatsLeft, hhmm, whenLabel } = require('../lib/schedule');

const initials = name => name.split(' ').slice(0, 2).map(w => w[0]).join('');
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();

function face(c, byId, cls) {
  const t = byId.get(c.employeeId);
  return t && t.photo
    ? `<img class="${cls}" src="../${esc(t.photo)}">`
    : `<div class="${cls} ini">${esc(initials(cleanName(c.employeeName)))}</div>`;
}

// Right end of a class row: seats left, "мест нет" when full, nothing for classes without booking.
function seats(c) {
  const n = seatsLeft(c);
  if (n === null) return '';
  if (n === 0) return '<div class="seats full"><b>мест нет</b></div>';
  return `<div class="seats"><span>осталось</span><b>${n}<i>${plural(n, 'место', 'места', 'мест')}</i></b></div>`;
}

const TITLE = 'Ближайшие занятия';

const CSS_COMMON = `
.ini { display: flex; align-items: center; justify-content: center; font: 800 44px 'Unbounded'; color: var(--green);
  background: #10140c; border: 3px solid rgba(141,198,63,.5); }
.head { position: absolute; left: 96px; top: 54px; right: 96px; display: flex; align-items: baseline; gap: 30px; }
.head .h1 { font-size: 92px; }
.head .when { font: 700 44px 'Manrope'; color: var(--green); }
`;

// 1. Broadcast: slanted plates per class.
function broadcast(sel, byId, now, when) {
  const n = sel.items.length;
  const rowH = n >= 4 ? 168 : 184;
  return page(CSS_COMMON + `
.head { right: 260px; } /* clear of the logo */
.head .h1 { font-size: 84px; white-space: nowrap; overflow: hidden; min-width: 0; }
.head .when { font-size: 40px; white-space: nowrap; flex: none; }
.list { position: absolute; left: 96px; right: 96px; top: 196px; bottom: 40px; display: flex; flex-direction: column;
  justify-content: center; gap: ${n >= 4 ? 18 : 26}px; }
.it { display: grid; grid-template-columns: 400px minmax(0, 1fr) 170px; align-items: center; height: ${rowH}px; }
.tm { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--green); transform: skewX(-12deg); }
.tm span { transform: skewX(12deg); font: 900 92px/1 'Unbounded'; color: #000; }
.body { height: 100%; background: #12150e; transform: skewX(-12deg); margin-left: -10px; padding: 0 30px 0 50px;
  display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.body { flex-direction: row; align-items: center; gap: 24px; }
.body > div { transform: skewX(12deg); }
.body .txt { flex: 1; min-width: 0; }
.seats { flex: none; text-align: right; padding-right: 10px; }
.seats span { display: block; font: 700 28px/1 'Manrope'; color: var(--muted); }
.seats b { display: block; margin-top: 6px; font: 900 72px/1 'Unbounded'; color: var(--green); }
.seats i { font: 800 34px 'Manrope'; font-style: normal; margin-left: 12px; color: var(--text); }
.seats.full b { font: 800 34px/1.1 'Unbounded'; text-transform: uppercase; color: var(--muted); }
.ttl { font: 800 64px/1.05 'Manrope'; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { margin-top: 8px; font: 700 44px 'Manrope'; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.it { animation: row-pulse 2.5s ease-in-out infinite; transform-origin: 0 50%; }
/* A highlight runs down the list: each row swells in turn, twice per 5 s slide. */
@keyframes row-pulse {
  0%, 30%, 100% { transform: none; filter: none; }
  12% { transform: scale(1.03); filter: brightness(1.25); }
}
.av { width: ${rowH - 10}px; height: ${rowH - 10}px; border-radius: 50%; object-fit: cover; object-position: 50% 10%;
  border: 5px solid var(--green); justify-self: end; }
`, `
<div class="head"><div class="h1" data-fit="60">${TITLE}</div>${when ? `<div class="when">${esc(when)}</div>` : ''}</div>
<div class="list">${sel.items.map((c, i) => `<div class="it" style="animation-delay: ${i * 0.35}s">
  <div class="tm"><span>${hhmm(c)}</span></div>
  <div class="body"><div class="txt"><div class="ttl" data-fit="48">${esc(c.title)}</div>
    <div class="sub">${esc(String(c.room || '').trim())} · ${esc(cleanName(c.employeeName))}</div></div>${seats(c)}</div>
  ${face(c, byId, 'av')}</div>`).join('')}</div>
${brand()}`);
}

// 2. Board: departure-board rows.
function board(sel, byId, now, when) {
  return page(CSS_COMMON + `
body { background: #0c0d0b; }
.cols { position: absolute; left: 96px; right: 96px; top: 200px; display: grid;
  grid-template-columns: 420px 1fr 520px; font: 700 30px 'Manrope'; color: var(--muted); text-transform: uppercase;
  letter-spacing: .08em; padding: 0 0 14px; border-bottom: 4px solid var(--green); }
.rows { position: absolute; left: 96px; right: 96px; top: 262px; }
.r { display: grid; grid-template-columns: 420px 1fr 520px; align-items: center; height: 190px;
  border-bottom: 2px solid #23271f; }
.r .tm { font: 900 100px 'Unbounded'; color: var(--green); }
.r .ttl { font: 800 68px/1.05 'Manrope'; padding-right: 30px; }
.r .room { margin-top: 6px; font: 700 46px 'Manrope'; color: var(--muted); }
.r .who { display: flex; align-items: center; gap: 22px; font: 800 46px/1.1 'Manrope'; }
.r .av { width: 130px; height: 130px; border-radius: 50%; object-fit: cover; object-position: 50% 10%; flex: none; }
`, `
<div class="head"><div class="h1" data-fit="60">${TITLE}</div>${when ? `<div class="when">${esc(when)}</div>` : ''}</div>
<div class="cols"><div>Время</div><div>Занятие</div><div>Тренер</div></div>
<div class="rows">${sel.items.map(c => `<div class="r">
  <div class="tm">${hhmm(c)}</div>
  <div><div class="ttl">${esc(c.title)}</div><div class="room">${esc(String(c.room || '').trim())}</div></div>
  <div class="who">${face(c, byId, 'av')}<span>${esc(cleanName(c.employeeName))}</span></div></div>`).join('')}</div>
${brand('bottom')}`);
}

// 3. Poster: one vertical column per class with a large face.
function poster(sel, byId, now, when) {
  const n = sel.items.length;
  return page(CSS_COMMON + `
.grid { position: absolute; left: 96px; right: 96px; top: 200px; bottom: 54px; display: grid;
  grid-template-columns: repeat(${n}, 1fr); gap: 32px; }
.c { position: relative; overflow: hidden; background: radial-gradient(circle at 50% 30%, #22301a, #0b0f07 65%);
  border-bottom: 10px solid var(--green); }
.c .ph { position: absolute; left: 50%; top: 0; height: 470px; transform: translateX(-50%); }
.c .ph.ini { width: 240px; height: 240px; top: 110px; border-radius: 50%; font-size: 96px; }
.c .sh { position: absolute; left: 0; right: 0; top: 320px; height: 150px; background: linear-gradient(0deg, #0b0f07 20%, transparent); }
.c .b { position: absolute; left: 34px; right: 34px; top: 470px; }
.c .tm { font: 900 96px/1 'Unbounded'; color: var(--green); }
.c .ttl { margin-top: 10px; font: 800 58px/1.05 'Manrope'; height: 122px; overflow: hidden; }
.c .sub { margin-top: 10px; font: 700 44px/1.15 'Manrope'; color: var(--muted); }
`, `
<div class="head"><div class="h1" data-fit="60">${TITLE}</div>${when ? `<div class="when">${esc(when)}</div>` : ''}</div>
<div class="grid">${sel.items.map(c => `<div class="c">
  ${face(c, byId, 'ph cutout')}<div class="sh"></div>
  <div class="b"><div class="tm">${hhmm(c)}</div><div class="ttl">${esc(c.title)}</div>
    <div class="sub">${esc(cleanName(c.employeeName))}<br>${esc(String(c.room || '').trim())}</div></div></div>`).join('')}</div>
${brand()}`);
}

const VARIANTS = { broadcast, board, poster };

module.exports = function hourSlide(classes, trainers, now, variant, day) {
  const sel = nextClasses(classes, now);
  if (!sel.items.length) return null;
  return VARIANTS[variant](sel, new Map(trainers.map(t => [t.id, t])), now, day ? whenLabel(day, now) : '');
};
