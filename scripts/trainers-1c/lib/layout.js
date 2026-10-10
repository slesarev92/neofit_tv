'use strict';
// Shared page shell: fonts, palette, texture, brand mark.

const path = require('path');

// Fonts and scripts are vendored so rendering never depends on the network.
const ASSETS = 'file:///' + path.join(__dirname, '..', 'assets').replace(/\\/g, '/');

const W = 1920;
const H = 1080;

const POSITION_LABELS = {
  'Инструктор тренажерного зала': 'Тренер тренажёрного зала',
  'Инструктор групповых программ': 'Групповые программы',
  'Инструктор по плаванию': 'Тренер по плаванию',
  'Инструктор по единоборствам': 'Единоборства',
};

const DIRECTION = {
  'Инструктор тренажерного зала': 'Тренажёрный зал',
  'Инструктор групповых программ': 'Групповые программы',
  'Инструктор по плаванию': 'Бассейн',
  'Инструктор по единоборствам': 'Единоборства',
};

// Film grain keeps large black areas from banding on cheap TV panels.
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter>"
  + "<rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>\")";

const BASE_CSS = `
@font-face { font-family: 'Unbounded'; src: url('${ASSETS}/Unbounded.ttf'); font-weight: 200 900; font-display: block; }
@font-face { font-family: 'Manrope'; src: url('${ASSETS}/Manrope.ttf'); font-weight: 200 800; font-display: block; }
:root { --green: #8dc63f; --green-dim: rgba(141,198,63,.16); --bg: #000; --panel: #0d0f0b; --line: #1d2119;
  --text: #f4f4f2; --muted: #92958c; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--bg); color: var(--text);
  font-family: 'Manrope', sans-serif; }
body::after { content: ''; position: absolute; inset: 0; background-image: ${GRAIN}; opacity: .06;
  pointer-events: none; mix-blend-mode: screen; z-index: 50; }
.logo { position: absolute; right: 96px; top: 54px; height: 64px; z-index: 10;
  animation: logo-pulse 2.5s ease-in-out infinite; transform-origin: 50% 50%; }
.logo.bottom { top: auto; bottom: 54px; }
/* Gentle breathing: two pulses per 5 s slide, peak glow in the slide accent. */
@keyframes logo-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(141,198,63,0)); }
  50% { transform: scale(1.08); filter: drop-shadow(0 0 18px rgba(141,198,63,.75)); }
}
.kicker { font: 700 26px 'Unbounded'; letter-spacing: .16em; text-transform: uppercase; color: var(--green); }
.h1 { font: 900 84px/1 'Unbounded'; text-transform: uppercase; }
.glow { position: absolute; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(141,198,63,.24) 0%, rgba(141,198,63,.06) 42%, transparent 68%); }
/* Studio shots are on black: lighten lets the backdrop show through the photo background. */
.cutout { mix-blend-mode: lighten; }
`;

// Shrinks elements marked data-fit until they fit their box (long surnames, long titles).
const FIT_JS = `<script>
document.fonts.ready.then(() => {
  document.querySelectorAll('[data-fit]').forEach(el => {
    let size = parseFloat(getComputedStyle(el).fontSize);
    const min = Number(el.dataset.fit) || 40;
    const tall = () => el.hasAttribute('data-fit-h') && el.scrollHeight > el.clientHeight + 2;
    while ((el.scrollWidth > el.clientWidth || tall()) && size > min) {
      size -= 2; el.style.fontSize = size + 'px';
    }
  });
});
</script>`;

const brand = (cls = '') => `<img class="logo ${cls}" src="${ASSETS}/neofit-logo.svg">`;

function page(css, body) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head>`
    + `<body>${body}${FIT_JS}</body></html>`;
}

module.exports = { W, H, ASSETS, POSITION_LABELS, DIRECTION, page, brand };
