#!/usr/bin/env node
// Pulls trainers and a day's schedule from the 1C:Fitness HTTP API into out/.
// Usage: node scripts/trainers-1c/fetch.js [YYYY-MM-DD]
// Credentials: FIT1C_* in .env (see docs/trainers-1c.md). out/ holds names/photos — gitignored.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const { FIT1C_BASE_URL, FIT1C_API_KEY, FIT1C_LOGIN, FIT1C_PASSWORD, FIT1C_CLUB_ID } = process.env;
if (!FIT1C_BASE_URL || !FIT1C_API_KEY || !FIT1C_LOGIN || !FIT1C_PASSWORD || !FIT1C_CLUB_ID) {
  console.error('FIT1C_* variables are missing in .env');
  process.exit(1);
}

const OUT = path.join(__dirname, 'out');
const PHOTOS = path.join(OUT, 'photos');
const AUTH = {
  Authorization: 'Basic ' + Buffer.from(`${FIT1C_LOGIN}:${FIT1C_PASSWORD}`).toString('base64'),
  apikey: FIT1C_API_KEY,
};

// Staff that /trainers returns but who are not trainers.
const EXCLUDED_POSITIONS = new Set([
  'Сотрудник детской комнаты',
  'Системный Администратор',
  'Фитнес менеджер',
]);

async function api(method, params) {
  const qs = new URLSearchParams({ club_id: FIT1C_CLUB_ID, ...params });
  const res = await fetch(`${FIT1C_BASE_URL}/${method}?${qs}`, { headers: AUTH });
  const body = await res.json().catch(() => null);
  if (!body || !body.result) {
    throw new Error(`${method}: HTTP ${res.status} ${body ? body.error_message : ''}`);
  }
  return body.data;
}

async function downloadPhoto(url, id) {
  const file = path.join(PHOTOS, `${id}.jpg`);
  const res = await fetch(url, { headers: AUTH });
  if (!res.ok) throw new Error(`photo ${id}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return path.relative(OUT, file).replace(/\\/g, '/');
}

function localDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function main() {
  const day = process.argv[2] || localDate(new Date());
  const next = localDate(new Date(new Date(`${day}T12:00:00`).getTime() + 86400000));
  fs.mkdirSync(PHOTOS, { recursive: true });

  // List = /trainers ∪ gym trainer ids that /trainers does not return yet (see journal).
  const list = await api('trainers', {});
  const extraIds = require('./extra-ids.json');
  const ids = [...new Set([...list.map(t => t.id), ...extraIds])];

  const trainers = [];
  for (const id of ids) {
    let e;
    try {
      e = await api('employee', { employee_id: id });
    } catch (err) {
      console.warn(`skip ${id}: ${err.message}`);
      continue;
    }
    const brief = list.find(t => t.id === id);
    const position = e.position && e.position.title;
    // Placeholders like "Инструктор по плаванию" keep the position in last_name and have no first name.
    const isPlaceholder = brief && !String(brief.name || '').trim();
    if (!position || EXCLUDED_POSITIONS.has(position) || isPlaceholder) continue;

    const photo = e.photo ? await downloadPhoto(e.photo, id) : null;
    trainers.push({
      id,
      name: String(e.name || '').replace(/\s+/g, ' ').trim(),
      position,
      photo,
      description: e.description || '',
      biography: e.biography || '',
      awards: e.awards || '',
      canTrainPersonally: e.can_train_personally,
      canTrainGroups: e.can_train_groups,
    });
  }

  const classes = (await api('classes', { start_date: day, end_date: next }))
    .filter(c => String(c.start_date).startsWith(day))
    .map(c => ({
      start: c.start_date,
      end: c.end_date,
      title: c.service && c.service.title ? c.service.title.trim() : '',
      course: c.service && c.service.course ? c.service.course.title : null,
      room: c.room ? c.room.title : null,
      employeeId: c.employee ? c.employee.id : null,
      employeeName: c.employee ? c.employee.name : null,
      canceled: !!c.canceled,
      capacity: c.capacity,
      booked: c.booked,
    }));

  fs.writeFileSync(path.join(OUT, 'trainers.json'), JSON.stringify(trainers, null, 2));
  fs.writeFileSync(path.join(OUT, 'classes.json'), JSON.stringify({ day, classes }, null, 2));
  console.log(`trainers: ${trainers.length} (with photo: ${trainers.filter(t => t.photo).length})`);
  console.log(`classes on ${day}: ${classes.length}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
