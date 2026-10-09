'use strict';
// "Today in the club": the day's classes in two columns, paginated.

const { esc } = require('../lib/text');
const { page, brand } = require('../lib/layout');

const ROWS_PER_COLUMN = 7;
const DAY_FMT = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

const CSS = `
.head { position: absolute; left: 80px; top: 64px; right: 80px; display: flex; align-items: baseline; gap: 36px; }
.head .h1 { font-size: 72px; }
.head .date { font: 700 40px 'Manrope'; color: var(--green); }
.head .page { font: 700 28px 'Unbounded'; color: var(--muted); }
.bar { position: absolute; left: 80px; top: 170px; width: 160px; height: 8px; background: var(--green); }
.cols { position: absolute; left: 80px; right: 80px; top: 214px; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 56px; }
.row { display: grid; grid-template-columns: 168px minmax(0, 1fr) 300px; align-items: center; height: 108px;
  border-bottom: 1px solid var(--line); }
.row:nth-child(odd) { background: linear-gradient(90deg, rgba(141,198,63,.05), transparent 70%); }
.time { font: 800 36px 'Unbounded'; color: var(--green); padding-left: 14px; }
.title { font: 800 32px/1.05 'Manrope'; padding-right: 16px; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; }
.room { font: 600 23px 'Manrope'; color: var(--muted); margin-top: 4px; }
.who { display: flex; align-items: center; gap: 16px; font: 700 24px/1.15 'Manrope'; }
.who .solo { padding-left: 84px; }
.ava { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; object-position: 50% 12%; flex: none;
  border: 3px solid var(--green); }
`;

function rowsFor(classes) {
  return classes
    .filter(c => !c.canceled && c.title && !/забронирован/i.test(c.title))
    .filter(c => c.employeeName && String(c.employeeName).trim().includes(' ')) // placeholders have one word
    .sort((a, b) => a.start.localeCompare(b.start));
}

module.exports = function todaySlides(day, classes, trainers) {
  const byId = new Map(trainers.map(t => [t.id, t]));
  const rows = rowsFor(classes);
  const perSlide = ROWS_PER_COLUMN * 2;
  const pages = [];
  for (let i = 0; i < rows.length; i += perSlide) pages.push(rows.slice(i, i + perSlide));
  const dateLabel = DAY_FMT.format(new Date(`${day}T12:00:00`));

  const row = c => {
    const t = byId.get(c.employeeId);
    const avatar = t && t.photo ? `<img class="ava" src="../${esc(t.photo)}">` : '';
    return `<div class="row">
      <div class="time">${esc(c.start.slice(11, 16))}</div>
      <div><div class="title">${esc(c.title)}</div><div class="room">${esc(String(c.room || '').trim())}</div></div>
      <div class="who">${avatar}<span class="${avatar ? '' : 'solo'}">${esc(String(c.employeeName).replace(/\s+/g, ' ').trim())}</span></div>
    </div>`;
  };

  return pages.map((p, idx) => page(CSS, `
<div class="head"><div class="h1">Сегодня в клубе</div><div class="date">${esc(dateLabel)}</div>
  ${pages.length > 1 ? `<div class="page">${idx + 1}/${pages.length}</div>` : ''}</div>
<div class="bar"></div>
<div class="cols">${[p.slice(0, ROWS_PER_COLUMN), p.slice(ROWS_PER_COLUMN)]
    .map(col => `<div>${col.map(row).join('')}</div>`).join('')}</div>
${brand('bottom')}`));
};

module.exports.rowsFor = rowsFor;
