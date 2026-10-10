'use strict';
// Schedule selection: which classes a slide shows relative to "now".

const MAX_TILES = 4;        // "next classes" slide
const LATER_ROWS = 6;       // "later today" slide

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

// The nearest classes that have not started yet, however far ahead (running ones are of no use to a viewer).
function upcoming(classes, now) {
  return realClasses(classes).filter(c => minutes(hhmm(c)) > minutes(now));
}

function nextClasses(classes, now) {
  return { items: upcoming(classes, now).slice(0, MAX_TILES) };
}

// The classes right after the "next classes" slide, for "later today".
function laterToday(classes, now, limit = LATER_ROWS) {
  return upcoming(classes, now).slice(MAX_TILES, MAX_TILES + limit);
}

// Seats left for booking, or null when the class takes no bookings (capacity 0) or uses the
// 100-seat "no limit" placeholder.
const NO_LIMIT = 100;
function seatsLeft(c) {
  if (!(c.capacity > 0) || c.capacity >= NO_LIMIT) return null;
  return Math.max(0, c.capacity - (c.booked || 0));
}

// «10 октября» — the day a static demo snapshot describes (demo only; live screens need no label).
const DAY_FMT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const whenLabel = day => DAY_FMT.format(new Date(`${day}T12:00:00`));

module.exports = { nextClasses, laterToday, seatsLeft, hhmm, whenLabel };
