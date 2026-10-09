#!/usr/bin/env node
// Renders 1920x1080 slides from out/trainers.json + out/classes.json via local headless Chrome.
// Usage: node scripts/trainers-1c/render.js   (run fetch.js first)
// Output: out/slides/*.jpg
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const OUT = path.join(__dirname, 'out');
const HTML = path.join(OUT, 'html');
const SLIDES = path.join(OUT, 'slides');
const W = 1920;
const H = 1080;
const ROWS_PER_COLUMN = 7;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const POSITION_LABELS = {
  'Инструктор тренажерного зала': 'Тренер тренажёрного зала',
  'Инструктор групповых программ': 'Групповые программы',
  'Инструктор по плаванию': 'Тренер по плаванию',
  'Инструктор по единоборствам': 'Единоборства',
};

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 1C stores rich text as HTML fragments; reduce to trimmed non-empty lines.
function htmlLines(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const bullet = s => s.replace(/^[-–—•·]\s*/, '').replace(/[.;,]$/, '').trim();
const clip = (s, n) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ') > n * 0.6 ? cut.lastIndexOf(' ') : n).replace(/[s,.;:–-]+$/, '') + '…';
};
const HEADER = /^(образование|специализация|достижения|опыт работы)/i;

function theses(t) {
  const lines = htmlLines(t.description);
  const exp = lines.join(' ').match(/опыт работы\s*:?\s*(\d+)\s*(лет|год)/i);

  const specs = [];
  const i = lines.findIndex(l => /^специализация/i.test(l));
  if (i >= 0) {
    for (const l of lines.slice(i + 1)) {
      if (HEADER.test(l)) break;
      const b = bullet(l);
      if (b) specs.push(b);
    }
  }
  // Short items read better from across the room; long ones go last and get clipped.
  specs.sort((a, b) => (a.length > 48) - (b.length > 48));

  const awards = htmlLines(t.awards).map(bullet).filter(Boolean);
  return {
    years: exp ? Number(exp[1]) : null,
    specs: specs.slice(0, 4).map(s => clip(s, 56)),
    awards: awards.slice(0, 2).map(s => clip(s, 80)),
  };
}

function yearsWord(n) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return 'год';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'года';
  return 'лет';
}

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@500;600;700&display=block');
:root { --green: #8dc63f; --bg: #000; --text: #f4f4f2; --muted: #9a9a96; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--bg); color: var(--text);
  font-family: 'Manrope', sans-serif; }
.brand { position: absolute; right: 80px; top: 60px; font: 700 24px 'Unbounded'; letter-spacing: .18em;
  color: var(--muted); }
.brand b { color: var(--green); font-weight: 700; }
`;

// Shrinks elements marked data-fit until they fit their box (long surnames).
const FIT_JS = `<script>
document.fonts.ready.then(() => {
  document.querySelectorAll('[data-fit]').forEach(el => {
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && size > 40) { size -= 2; el.style.fontSize = size + 'px'; }
  });
});
</script>`;

function trainerSlide(t) {
  const th = theses(t);
  const [surname, ...rest] = t.name.split(' ');
  const label = POSITION_LABELS[t.position] || t.position;
  const stat = th.years
    ? `<div class="stat"><span class="num">${th.years}</span><span class="unit">${yearsWord(th.years)}<br>опыта</span></div>`
    : '';
  const specs = th.specs.length
    ? `<ul class="specs">${th.specs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
  const awards = th.awards.length
    ? `<div class="awards">${th.awards.map(a => `<div>★&nbsp; ${esc(a)}</div>`).join('')}</div>` : '';

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${BASE_CSS}
.glow { position: absolute; left: -200px; top: 80px; width: 1300px; height: 1300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(141,198,63,.22) 0%, rgba(141,198,63,.06) 40%, transparent 68%); }
.stripe { position: absolute; left: 690px; top: -100px; width: 26px; height: 1400px; background: var(--green);
  transform: rotate(14deg); opacity: .9; }
.photo { position: absolute; left: 40px; bottom: 0; height: 1040px; mix-blend-mode: lighten; }
.photo-fade { position: absolute; left: 0; top: 0; width: 980px; height: 100%;
  background: linear-gradient(90deg, transparent 62%, var(--bg) 92%), linear-gradient(0deg, var(--bg) 0%, transparent 14%),
    linear-gradient(180deg, var(--bg) 0%, transparent 10%); }
.info { position: absolute; left: 960px; top: 150px; bottom: 60px; width: 880px; }
.label { font: 700 26px 'Unbounded'; letter-spacing: .14em; text-transform: uppercase; color: var(--green); }
.name { margin-top: 28px; font: 800 112px/1 'Unbounded'; text-transform: uppercase; white-space: nowrap;
  overflow: hidden; }
.name.first { color: var(--green); margin-top: 8px; }
.stat { display: flex; align-items: center; gap: 22px; margin-top: 52px; }
.num { font: 800 132px/0.9 'Unbounded'; color: var(--text); }
.unit { font: 600 34px/1.15 'Manrope'; color: var(--muted); }
.specs { list-style: none; margin-top: 44px; display: flex; flex-direction: column; gap: 16px; }
.specs li { font: 600 36px/1.2 'Manrope'; padding-left: 40px; position: relative; }
.specs li::before { content: ''; position: absolute; left: 0; top: 17px; width: 18px; height: 6px;
  background: var(--green); }
.awards { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; font: 500 28px/1.25 'Manrope';
  color: var(--muted); }
.awards div { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style></head><body>
<div class="glow"></div><div class="stripe"></div>
<img class="photo" src="../${esc(t.photo)}"><div class="photo-fade"></div>
<div class="info">
  <div class="label">${esc(label)}</div>
  <div class="name" data-fit>${esc(surname)}</div>
  <div class="name first" data-fit>${esc(rest.join(' '))}</div>
  ${stat}${specs}${awards}
</div>
<div class="brand"><b>NEO</b>FIT · КРЫЛАТСКОЕ</div>
${FIT_JS}</body></html>`;
}

const DAY_FMT = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

function scheduleSlides(day, classes, trainers) {
  const byId = new Map(trainers.map(t => [t.id, t]));
  const positions = new Set(Object.keys(POSITION_LABELS));
  const rows = classes
    .filter(c => !c.canceled && c.title && !/забронирован/i.test(c.title))
    .filter(c => !positions.has(String(c.employeeName || '').trim())) // placeholder staff
    .sort((a, b) => a.start.localeCompare(b.start));

  const perSlide = ROWS_PER_COLUMN * 2;
  const pages = [];
  for (let i = 0; i < rows.length; i += perSlide) pages.push(rows.slice(i, i + perSlide));
  const dateLabel = DAY_FMT.format(new Date(`${day}T12:00:00`));

  const row = c => {
    const t = byId.get(c.employeeId);
    const avatar = t && t.photo
      ? `<img class="ava" src="../${esc(t.photo)}">`
      : `<div class="ava none"></div>`;
    const name = String(c.employeeName || '').replace(/\s+/g, ' ').trim();
    return `<div class="row">
      <div class="time">${esc(c.start.slice(11, 16))}</div>
      <div class="what"><div class="title">${esc(c.title)}</div><div class="room">${esc(String(c.room || '').trim())}</div></div>
      <div class="who">${avatar}<span>${esc(name)}</span></div>
    </div>`;
  };

  return pages.map((page, idx) => {
    const cols = [page.slice(0, ROWS_PER_COLUMN), page.slice(ROWS_PER_COLUMN)];
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${BASE_CSS}
.head { position: absolute; left: 80px; top: 64px; right: 80px; display: flex; align-items: baseline; gap: 36px; }
.head h1 { font: 800 72px/1 'Unbounded'; text-transform: uppercase; }
.head .date { font: 600 40px 'Manrope'; color: var(--green); }
.head .page { margin-left: 8px; font: 700 28px 'Unbounded'; color: var(--muted); }
.bar { position: absolute; left: 80px; top: 170px; width: 160px; height: 8px; background: var(--green); }
.cols { position: absolute; left: 80px; right: 80px; top: 218px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: 64px; }
.row { display: grid; grid-template-columns: 172px minmax(0, 1fr) 300px; align-items: center; height: 108px;
  border-bottom: 1px solid #1f1f1d; }
.time { font: 700 36px 'Unbounded'; color: var(--green); }
.title { font: 700 32px/1.05 'Manrope'; padding-right: 16px; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; }
.room { font: 500 24px 'Manrope'; color: var(--muted); margin-top: 4px; }
.who { display: flex; align-items: center; gap: 16px; font: 600 24px/1.15 'Manrope'; }
.ava { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; object-position: 50% 12%; flex: none;
  border: 3px solid var(--green); background: #151514; }
.ava.none { border-color: #2a2a28; }
.brand.bottom { top: auto; bottom: 48px; }
</style></head><body>
<div class="head"><h1>Сегодня в клубе</h1><div class="date">${esc(dateLabel)}</div>
  ${pages.length > 1 ? `<div class="page">${idx + 1}/${pages.length}</div>` : ''}</div>
<div class="bar"></div>
<div class="cols">${cols.map(c => `<div>${c.map(row).join('')}</div>`).join('')}</div>
<div class="brand bottom"><b>NEO</b>FIT · КРЫЛАТСКОЕ</div>
</body></html>`;
  });
}

function findChrome() {
  const found = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found; set CHROME_PATH');
  return found;
}

async function shoot(chrome, htmlFile, jpgFile) {
  const png = jpgFile.replace(/\.jpg$/, '.png');
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--window-size=${W},${H}`, '--virtual-time-budget=10000', `--screenshot=${png}`,
    'file:///' + htmlFile.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  await sharp(png).resize(W, H, { fit: 'cover', position: 'top' }).jpeg({ quality: 90 }).toFile(jpgFile);
  fs.unlinkSync(png);
}

async function main() {
  const trainers = require(path.join(OUT, 'trainers.json'));
  const { day, classes } = require(path.join(OUT, 'classes.json'));
  fs.rmSync(HTML, { recursive: true, force: true });
  fs.rmSync(SLIDES, { recursive: true, force: true });
  fs.mkdirSync(HTML, { recursive: true });
  fs.mkdirSync(SLIDES, { recursive: true });

  const jobs = [];
  trainers.filter(t => t.photo).forEach((t, i) => {
    jobs.push([`trainer-${String(i + 1).padStart(2, '0')}`, trainerSlide(t)]);
  });
  scheduleSlides(day, classes, trainers).forEach((html, i) => jobs.push([`today-${i + 1}`, html]));

  const chrome = findChrome();
  for (const [name, html] of jobs) {
    const file = path.join(HTML, `${name}.html`);
    fs.writeFileSync(file, html);
    await shoot(chrome, file, path.join(SLIDES, `${name}.jpg`));
    process.stdout.write('.');
  }
  console.log(`\n${jobs.length} slides → ${path.relative(process.cwd(), SLIDES)}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
