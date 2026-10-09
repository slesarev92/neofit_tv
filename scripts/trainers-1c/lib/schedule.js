'use strict';
// Schedule selection: which classes a slide shows relative to "now".

const WINDOW_MIN = 60;      // "next hour" window
const GRACE_MIN = 10;       // a class that started ≤10 min ago is still worth walking into
const MAX_TILES = 4;

const minutes = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = c => c.start.slice(11, 16);

// Kids' room activities are not for gym-floor screens.
const KIDS = /детская комната/i;

// Real classes only: no room bookings, no kids' room, no placeholder staff (single word = position, not a person).
function realClasses(classes) {
  return classes
    .filter(c => !c.canceled && c.title && !/забронирован/i.test(c.title))
    .filter(c => !KIDS.test(String(c.room || '')) && !KIDS.test(String(c.course || '')))
    .filter(c => c.employeeName && String(c.employeeName).trim().includes(' '))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Classes starting within the next hour (or just started); falls back to the nearest upcoming one.
function nextHour(classes, now) {
  const t = minutes(now);
  const all = realClasses(classes);
  const inWindow = all.filter(c => {
    const s = minutes(hhmm(c));
    return s >= t - GRACE_MIN && s <= t + WINDOW_MIN;
  });
  if (inWindow.length) return { mode: 'hour', items: inWindow.slice(0, MAX_TILES) };
  const upcoming = all.find(c => minutes(hhmm(c)) > t);
  return { mode: 'next', items: upcoming ? [upcoming] : [] };
}

// Upcoming classes not already on the next-hour slide (incl. ones cut by MAX_TILES), for "later today".
function laterToday(classes, now, limit = 6) {
  const shown = new Set(nextHour(classes, now).items);
  return realClasses(classes)
    .filter(c => minutes(hhmm(c)) > minutes(now) && !shown.has(c))
    .slice(0, limit);
}

const isRunning = (c, now) => minutes(hhmm(c)) <= minutes(now);

// «суббота, 10 октября · 17:05» — tells viewers which moment a static snapshot describes.
const DAY_FMT = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const whenLabel = (day, now) => `${DAY_FMT.format(new Date(`${day}T12:00:00`))} · ${now}`;

module.exports = { nextHour, laterToday, isRunning, hhmm, whenLabel };
