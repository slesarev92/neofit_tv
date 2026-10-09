'use strict';
// Text helpers: 1C rich-text parsing, trainer theses, Russian plurals.

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

const bullet = s => s.replace(/^[-–—•·*]\s*/, '').replace(/[.;,]$/, '').trim();

// Clips at a word boundary when one is close enough to the limit.
function clip(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const space = cut.lastIndexOf(' ');
  return cut.slice(0, space > n * 0.6 ? space : n).replace(/[\s,.;:–-]+$/, '') + '…';
}

const HEADER = /^(образование|специализация|достижения|опыт работы)/i;

// Achievements that read as titles worth a full slide.
const TITLE_AWARD = /(мастер спорта|мсмк|кмс|чемпион|призёр|призер|победител|обладател)/i;
const SPORTS_TITLE = /(мастер спорта|мсмк|\bкмс\b|кандидат в мастера)/i;

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
  // Short items read better from across the room; long ones go last.
  specs.sort((a, b) => (a.length > 34) - (b.length > 34));

  const awards = htmlLines(t.awards).map(bullet).filter(Boolean);
  return {
    years: exp ? Number(exp[1]) : null,
    specs: specs.slice(0, 4).map(s => clip(s, 40)),
    awards: awards.map(s => clip(s, 90)),
    topAward: awards.find(a => TITLE_AWARD.test(a)) || null,
    hasSportsTitle: awards.some(a => SPORTS_TITLE.test(a)),
  };
}

function plural(n, one, few, many) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

const yearsWord = n => plural(n, 'год', 'года', 'лет');

module.exports = { esc, htmlLines, clip, theses, plural, yearsWord };
