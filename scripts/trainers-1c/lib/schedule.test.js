'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { nextClasses, laterToday } = require('./schedule');

const cls = (start, title, room, employeeName = 'Иванов Иван', extra = {}) =>
  ({ start: `2026-10-10 ${start}:00`, title, room, course: null, employeeName, canceled: false, ...extra });

test('next hour excludes kids room, bookings and placeholder staff', () => {
  const classes = [
    cls('13:00', 'Плавание', 'Бассейн'),
    cls('13:00', 'Квилинг', 'Детская комната'),
    cls('13:00', 'Йога', 'Зал', 'Иванов Иван', { course: 'Детская комната' }),
    cls('13:10', 'Зал забронирован', 'Зал Энергия'),
    cls('13:20', 'Стретчинг', 'Зал Энергия', 'Инструктор '),
  ];
  const sel = nextClasses(classes, '12:50');
  assert.deepStrictEqual(sel.items.map(c => c.title), ['Плавание']);
});

test('next classes: four nearest that have not started yet, however far away', () => {
  const classes = ['16:55', '17:00', '17:30', '19:00', '20:00', '21:00']
    .map((t, i) => cls(t, `Класс ${i + 1}`, 'Зал'));
  const sel = nextClasses(classes, '17:00');
  assert.deepStrictEqual(sel.items.map(c => c.title), ['Класс 3', 'Класс 4', 'Класс 5', 'Класс 6']);
});

test('later today skips kids room', () => {
  const items = laterToday([
    ...['13:00', '13:10', '13:20', '13:30'].map(t => cls(t, 'Рано', 'Зал')),
    cls('14:00', 'Аппликация', 'Детская комната'), cls('14:00', 'Бачата', 'Зал'),
  ], '12:50');
  assert.deepStrictEqual(items.map(c => c.title), ['Бачата']);
});

test('later today continues after the next four, up to six rows', () => {
  const classes = ['17:00', '17:10', '17:10', '17:20', '17:30', '18:00', '18:00', '19:00', '19:30', '20:00', '21:00', '22:00']
    .map((t, i) => cls(t, `Класс ${i + 1}`, 'Зал'));
  assert.strictEqual(nextClasses(classes, '17:05').items.length, 4);
  assert.deepStrictEqual(laterToday(classes, '17:05').map(c => c.title),
    ['Класс 6', 'Класс 7', 'Класс 8', 'Класс 9', 'Класс 10', 'Класс 11']);
});

test('seats left: only for classes with real booking limits', () => {
  const { seatsLeft } = require('./schedule');
  assert.strictEqual(seatsLeft({ capacity: 12, booked: 8 }), 4);
  assert.strictEqual(seatsLeft({ capacity: 12, booked: 12 }), 0);
  assert.strictEqual(seatsLeft({ capacity: 12, booked: 14 }), 0); // overbooked by staff
  assert.strictEqual(seatsLeft({ capacity: 0, booked: 0 }), null); // no booking for this class
  assert.strictEqual(seatsLeft({ capacity: 100, booked: 0 }), null); // 100 = "no limit" placeholder in 1C
  assert.strictEqual(seatsLeft({}), null);
});
