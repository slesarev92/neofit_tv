// One-off (server side): register slides from /tmp/trainers-test as media, build a playlist, create a test screen.
// Run ONLY with the app stopped: repositories cache data/*.json in memory and the running app would overwrite the files.
// Procedure and rollback: docs/trainers-1c.md.
process.chdir('/opt/signage');
require('/opt/signage/node_modules/dotenv').config({ path: '/opt/signage/.env' });
const fs = require('fs');
const path = require('path');
const media = require('/opt/signage/src/modules/media/media.service');
const playlists = require('/opt/signage/src/modules/playlists/playlists.service');
const screens = require('/opt/signage/src/modules/screens/screens.service');

(async () => {
  const src = '/tmp/trainers-test';
  const files = fs.readdirSync(src).filter(f => f.endsWith('.jpg')).sort((a, b) => {
    const r = f => (f.startsWith('today') ? 0 : 1);
    return r(a) - r(b) || a.localeCompare(b);
  });
  const items = [];
  for (const f of files) {
    const tmp = path.join('/tmp', `up-${Date.now()}-${f}`);
    fs.copyFileSync(path.join(src, f), tmp);
    const res = await media.upload({ path: tmp, originalname: `trainers-test-${f}`, mimetype: 'image/jpeg', size: fs.statSync(tmp).size });
    if (!res.ok) throw new Error(`${f}: ${res.error}`);
    items.push({ mediaId: res.item.id, duration: f.startsWith('today') ? 20 : 12 });
  }
  const pl = await playlists.create({ name: 'TEST-TRAINERS-KR', items });
  if (!pl.ok) throw new Error(pl.error);
  const sc = await screens.create({ name: 'Крыло-TEST (тренеры)', playlistId: pl.item.id });
  if (!sc.ok) throw new Error(sc.error);
  console.log(JSON.stringify({ media: items.length, playlistId: pl.item.id, screenId: sc.item.id }));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
