#!/usr/bin/env node
// Renders v3 «Эфир» slides from out/trainers.json + out/classes.json.
// Usage: node scripts/trainers-1c/render.js [--now=HH:MM] [--day-trainers=Surname1,Surname2,Surname3] [--video]
// Output: out/slides/*.jpg (all cards + schedule) and out/slides/demo/ (one loop, show order):
// JPEG stills, or with --video animated 5 s MP4s of the loop slides.
'use strict';

const fs = require('fs');
const path = require('path');
const { shoot } = require('./lib/shoot');
const { record } = require('./lib/record');
const { theses } = require('./lib/text');
const cardSlide = require('./slides/card');
const hourSlide = require('./slides/hour');
const laterSlide = require('./slides/later');

const OUT = path.join(__dirname, 'out');
const HTML = path.join(OUT, 'html');
const SLIDES = path.join(OUT, 'slides');
const DEMO = path.join(SLIDES, 'demo');
const QR_URL = 'https://k.n-fit.ru/offer/?link=trainers'; // placeholder until the club gives a booking link
const STYLE = 'broadcast';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];

// Demo stand-in for daily rotation: the three richest cards (years + specializations).
function pickDay(trainers, names) {
  if (names) return names.split(',').map(n => trainers.find(t => t.name.startsWith(n))).filter(Boolean);
  const score = t => { const th = theses(t); return (th.years ? 2 : 0) + Math.min(th.specs.length, 2); };
  return [...trainers].sort((a, b) => score(b) - score(a)).slice(0, 3);
}

async function main() {
  const now = arg('now', '12:50');
  const trainers = require(path.join(OUT, 'trainers.json')).filter(t => t.photo);
  const { day, classes } = require(path.join(OUT, 'classes.json'));
  for (const d of [HTML, SLIDES]) fs.rmSync(d, { recursive: true, force: true });
  for (const d of [HTML, SLIDES, DEMO]) fs.mkdirSync(d, { recursive: true });

  const jobs = trainers.map((t, i) => [`card-${String(i + 1).padStart(2, '0')}`, cardSlide(t, STYLE, QR_URL), t]);
  const hour = hourSlide(classes, trainers, now, STYLE, day);
  if (hour) jobs.push(['hour', hour]);
  const later = laterSlide(classes, now, day);
  if (later) jobs.push(['later', later]);

  for (const [name, html] of jobs) {
    const file = path.join(HTML, `${name}.html`);
    fs.writeFileSync(file, html);
    await shoot(file, path.join(SLIDES, `${name}.jpg`));
    process.stdout.write('.');
  }

  const cardOf = t => jobs.find(j => j[2] === t)[0];
  const [a, b, c] = pickDay(trainers, arg('day-trainers', ''));
  const loop = [hour && 'hour', cardOf(a), cardOf(b), hour && 'hour', cardOf(c), later && 'later'].filter(Boolean);
  const video = process.argv.includes('--video');
  if (video) {
    for (const name of new Set(loop)) {
      await record(path.join(HTML, `${name}.html`), path.join(SLIDES, `${name}.mp4`));
      process.stdout.write('v');
    }
  }
  const ext = video ? 'mp4' : 'jpg';
  loop.forEach((name, i) => fs.copyFileSync(path.join(SLIDES, `${name}.${ext}`), path.join(DEMO, `${i + 1}-${name}.${ext}`)));
  console.log(`\n${jobs.length} slides; demo loop: ${loop.join(' → ')}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
