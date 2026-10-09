'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { nextHour, laterToday } = require('./schedule');

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
  const sel = nextHour(classes, '12:50');
  assert.strictEqual(sel.mode, 'hour');
  assert.deepStrictEqual(sel.items.map(c => c.title), ['Плавание']);
});

test('empty window falls back to the nearest upcoming class', () => {
  const sel = nextHour([cls('18:00', 'Тай бо', 'Зал Энергия')], '15:00');
  assert.strictEqual(sel.mode, 'next');
  assert.strictEqual(sel.items[0].title, 'Тай бо');
});

test('later today starts after the window and skips kids room', () => {
  const items = laterToday([
    cls('13:30', 'Рано', 'Зал'), cls('14:00', 'Аппликация', 'Детская комната'), cls('14:00', 'Бачата', 'Зал'),
  ], '12:50');
  assert.deepStrictEqual(items.map(c => c.title), ['Бачата']);
});
