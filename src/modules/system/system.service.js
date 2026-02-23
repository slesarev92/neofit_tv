const os = require('os');
const path = require('path');
const config = require('../../config');
const checkDiskSpace = require('check-disk-space').default;

const MAX_LOAD_HISTORY = 24;
const loadHistory = [];

function sampleLoad() {
  const la = os.loadavg();
  if (la && la.length > 0 && Number.isFinite(la[0])) {
    loadHistory.push(la[0]);
    if (loadHistory.length > MAX_LOAD_HISTORY) loadHistory.shift();
  }
}
setInterval(sampleLoad, 30000);
sampleLoad();

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return null;
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return gb.toFixed(2) + ' ГБ';
  const mb = bytes / (1024 ** 2);
  return mb.toFixed(1) + ' МБ';
}

async function getSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usedMemPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

  let loadAvg = os.loadavg();
  const hasLoadAvg = loadAvg && (loadAvg[0] > 0 || loadAvg[1] > 0 || loadAvg[2] > 0);
  if (!hasLoadAvg) loadAvg = null;

  const cpus = os.cpus();
  const cores = cpus ? cpus.length : 0;

  let disk = null;
  try {
    const diskPath = path.resolve(config.dataDir);
    const space = await checkDiskSpace(diskPath);
    if (space && Number.isFinite(space.free) && Number.isFinite(space.size)) {
      const used = space.size - space.free;
      const usedPercent = space.size > 0 ? Math.round((used / space.size) * 100) : 0;
      disk = {
        free: space.free,
        total: space.size,
        freeFormatted: formatBytes(space.free),
        totalFormatted: formatBytes(space.size),
        usedPercent,
      };
    }
  } catch (err) {
    disk = { error: err.message };
  }

  const ifaces = os.networkInterfaces();
  const network = [];
  if (ifaces && typeof ifaces === 'object') {
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!Array.isArray(addrs)) continue;
      const addresses = addrs
        .filter((a) => a && a.address)
        .map((a) => ({ address: a.address, family: a.family || 'IPv4' }));
      if (addresses.length) network.push({ name, addresses });
    }
  }

  return {
    loadAvg: loadAvg ? { 1: loadAvg[0], 5: loadAvg[1], 15: loadAvg[2] } : null,
    loadHistory: loadHistory.slice(),
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usedPercent: usedMemPercent,
      totalFormatted: formatBytes(totalMem),
      freeFormatted: formatBytes(freeMem),
    },
    cpu: { cores },
    disk,
    network,
    uptimeSeconds: Math.floor(os.uptime()),
  };
}

module.exports = { getSystemStats };
