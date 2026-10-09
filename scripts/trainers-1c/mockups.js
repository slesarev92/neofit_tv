#!/usr/bin/env node
// Design comparison: the same trainer and schedule rendered in every visual direction.
// Usage: node scripts/trainers-1c/mockups.js [--now=HH:MM] [--trainer=<surname>]
// Output: out/mockups/*.jpg
'use strict';

const fs = require('fs');
const path = require('path');
const { shoot } = require('./lib/shoot');
const cardSlide = require('./slides/card');
const hourSlide = require('./slides/hour');
const laterSlide = require('./slides/later');

const OUT = path.join(__dirname, 'out');
const DIR = path.join(OUT, 'mockups');
const QR_URL = 'https://k.n-fit.ru/offer/?link=trainers'; // placeholder until the club gives a booking link
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];

async function main() {
  const now = arg('now', '12:50');
  const who = arg('trainer', 'Матюхин');
  const trainers = require(path.join(OUT, 'trainers.json')).filter(t => t.photo);
  const { classes } = require(path.join(OUT, 'classes.json'));
  const t = trainers.find(x => x.name.startsWith(who));
  if (!t) throw new Error(`trainer ${who} not found`);

  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const jobs = [];
  for (const v of cardSlide.VARIANTS) {
    jobs.push([`card-${v}`, cardSlide(t, v, QR_URL)]);
    jobs.push([`hour-${v}`, hourSlide(classes, trainers, now, v)]);
  }
  jobs.push(['later', laterSlide(classes, now)]);

  for (const [name, html] of jobs.filter(j => j[1])) {
    const file = path.join(DIR, `${name}.html`);
    fs.writeFileSync(file, html);
    await shoot(file, path.join(DIR, `${name}.jpg`));
    process.stdout.write('.');
  }
  console.log(`\nmockups → ${path.relative(process.cwd(), DIR)}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
