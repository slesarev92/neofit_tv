'use strict';
// HTML file → 1920x1080 JPEG via local headless Chrome (no npm browser dependency).

const fs = require('fs');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const { W, H } = require('./layout');

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

async function shoot(htmlFile, jpgFile) {
  const png = jpgFile.replace(/\.jpg$/, '.png');
  execFileSync(findChrome(), [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--window-size=${W},${H}`, '--virtual-time-budget=10000', `--screenshot=${png}`,
    'file:///' + htmlFile.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  await sharp(png).resize(W, H, { fit: 'cover', position: 'top' }).jpeg({ quality: 90 }).toFile(jpgFile);
  fs.unlinkSync(png);
}

module.exports = { shoot };
