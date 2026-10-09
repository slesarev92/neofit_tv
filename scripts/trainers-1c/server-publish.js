// Server side, one-off publishing of rendered slides (test stage only; no admin UI yet).
// Usage on the server: node server-publish.js <slidesDir> <playlistName> <durationSec> <screenId>
//   Uploads every *.jpg in slidesDir as media (sorted by name), creates the playlist or replaces
//   its items if a playlist with that name exists, and assigns it to the screen.
// Run ONLY with the app stopped: repositories cache data/*.json in memory and the running app
// would overwrite the files. Procedure and rollback: docs/trainers-1c.md.
'use strict';

const APP = '/opt/signage';
process.chdir(APP);
require(`${APP}/node_modules/dotenv`).config({ path: `${APP}/.env` });
const fs = require('fs');
const path = require('path');
const media = require(`${APP}/src/modules/media/media.service`);
const playlists = require(`${APP}/src/modules/playlists/playlists.service`);
const screens = require(`${APP}/src/modules/screens/screens.service`);

async function main() {
  const [dir, playlistName, durationArg, screenId] = process.argv.slice(2);
  const duration = Number(durationArg);
  if (!dir || !playlistName || !duration || !screenId) {
    throw new Error('usage: server-publish.js <slidesDir> <playlistName> <durationSec> <screenId>');
  }
  if (!(await screens.getById(screenId))) throw new Error(`screen ${screenId} not found`);

  const items = [];
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.jpg')).sort()) {
    // upload() moves the file, so hand it a copy.
    const tmp = path.join('/tmp', `up-${Date.now()}-${f}`);
    fs.copyFileSync(path.join(dir, f), tmp);
    const res = await media.upload({
      path: tmp, originalname: `trainers-${f}`, mimetype: 'image/jpeg', size: fs.statSync(tmp).size,
    });
    if (!res.ok) throw new Error(`${f}: ${res.error}`);
    items.push({ mediaId: res.item.id, duration });
  }

  const existing = (await playlists.list()).find(p => p.name === playlistName);
  const pl = existing
    ? await playlists.update(existing.id, { items })
    : await playlists.create({ name: playlistName, items });
  if (!pl.ok) throw new Error(pl.error);

  const sc = await screens.update(screenId, { playlistId: pl.item.id });
  if (!sc.ok) throw new Error(sc.error);
  console.log(JSON.stringify({ media: items.length, playlistId: pl.item.id, created: !existing, screenId }));
}

main().then(() => process.exit(0)).catch(e => { console.error('FAIL', e.message); process.exit(1); });
