'use strict';
// HTML file → 1920x1080 H.264 MP4 of fixed length. Deterministic: every CSS animation is paused and
// seeked to the frame time before each screenshot, so output never depends on machine speed.
// Chrome is driven over the DevTools protocol with Node's built-in WebSocket (no npm browser dependency).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { W, H } = require('./layout');
const { findChrome } = require('./shoot');

const FPS = 30;

// Same encoder settings as the server's full transcode (media.processor.js), so upload is a remux.
const FFMPEG_ARGS = ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
  '-crf', '23', '-preset', 'medium', '-r', String(FPS), '-maxrate', '8M', '-bufsize', '16M', '-an',
  '-movflags', '+faststart'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function devtoolsPage(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* Chrome still starting */ }
    await sleep(100);
  }
  throw new Error('Chrome DevTools did not come up');
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    const p = msg.id && pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  };
  const ready = new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { ready, send, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function record(htmlFile, mp4File, seconds = 5) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
    'file:///' + htmlFile.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS),
    '-i', '-', ...FFMPEG_ARGS, mp4File], { stdio: ['pipe', 'ignore', 'inherit'] });
  const ffDone = new Promise((resolve, reject) => ff.on('close', c => (c ? reject(new Error(`ffmpeg exit ${c}`)) : resolve())));

  const cdp = cdpClient(await devtoolsPage(port));
  try {
    await cdp.ready;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    // Fonts, images and the fit/QR scripts must settle before frame 0.
    await evaluate(cdp, `new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r)))
      .then(() => document.fonts.ready).then(() => new Promise(r => setTimeout(r, 300))).then(() => true)`);
    const frames = Math.round(seconds * FPS);
    for (let i = 0; i < frames; i++) {
      const t = (i * 1000) / FPS;
      await evaluate(cdp, `document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${t}; }); true`);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
  } finally {
    ff.stdin.end();
    cdp.close();
    chrome.kill();
  }
  await ffDone;
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

module.exports = { record, FPS };
