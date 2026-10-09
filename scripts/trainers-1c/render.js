#!/usr/bin/env node
// Renders 1920x1080 slides from out/trainers.json + out/classes.json via local headless Chrome.
// Usage: node scripts/trainers-1c/render.js [--now=HH:MM]   (run fetch.js first)
//   --now  reference time for the "coming up" slide (default 12:30)
// Output: out/slides/*.jpg (full set) and out/slides/demo/*.jpg (one slide of each kind, in show order).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const { W, H } = require('./lib/layout');
const { theses } = require('./lib/text');
const trainerSlide = require('./slides/trainer');
const achievementSlide = require('./slides/achievement');
const todaySlides = require('./slides/today');
const nextSlide = require('./slides/next');
const teamSlide = require('./slides/team');
const statsSlide = require('./slides/stats');

const OUT = path.join(__dirname, 'out');
const HTML = path.join(OUT, 'html');
const SLIDES = path.join(OUT, 'slides');
const DEMO = path.join(SLIDES, 'demo');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

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

// Richest card for the demo: most specs + an achievement + known experience.
function richness(t) {
  const th = theses(t);
  return th.specs.length + (th.years ? 2 : 0) + (th.topAward ? 3 : 0);
}

async function main() {
  const now = (process.argv.find(a => a.startsWith('--now=')) || '--now=12:30').slice(6);
  const all = require(path.join(OUT, 'trainers.json'));
  const trainers = all.filter(t => t.photo); // no photo — not shown anywhere for now
  const { day, classes } = require(path.join(OUT, 'classes.json'));

  for (const dir of [HTML, SLIDES]) fs.rmSync(dir, { recursive: true, force: true });
  for (const dir of [HTML, SLIDES, DEMO]) fs.mkdirSync(dir, { recursive: true });

  const jobs = [];
  const pad = i => String(i + 1).padStart(2, '0');
  trainers.forEach((t, i) => jobs.push([`trainer-${pad(i)}`, trainerSlide(t)]));
  const titled = trainers.filter(t => theses(t).topAward);
  titled.forEach((t, i) => jobs.push([`achievement-${pad(i)}`, achievementSlide(t)]));
  todaySlides(day, classes, trainers).forEach((html, i) => jobs.push([`today-${i + 1}`, html]));
  const next = nextSlide(day, classes, trainers, now);
  if (next) jobs.push(['next', next]);
  jobs.push(['team', teamSlide(trainers)]);
  jobs.push(['stats', statsSlide(trainers)]);

  const chrome = findChrome();
  for (const [name, html] of jobs) {
    const file = path.join(HTML, `${name}.html`);
    fs.writeFileSync(file, html);
    await shoot(chrome, file, path.join(SLIDES, `${name}.jpg`));
    process.stdout.write('.');
  }

  const bestCard = trainers.indexOf([...trainers].sort((a, b) => richness(b) - richness(a))[0]);
  const bestTitle = titled.findIndex(t => /мастер спорта международного/i.test(theses(t).topAward));
  const demo = [
    `trainer-${pad(bestCard)}`,
    `achievement-${pad(Math.max(0, bestTitle))}`,
    next ? 'next' : null,
    'today-1',
    'team',
    'stats',
  ].filter(Boolean);
  demo.forEach((name, i) => fs.copyFileSync(path.join(SLIDES, `${name}.jpg`), path.join(DEMO, `${i + 1}-${name}.jpg`)));

  console.log(`\n${jobs.length} slides → ${path.relative(process.cwd(), SLIDES)}; demo: ${demo.join(', ')}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
