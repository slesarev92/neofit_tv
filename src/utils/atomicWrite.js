const fs = require('fs').promises;
const path = require('path');

// Process-local counter — combined with pid + Date.now() this guarantees
// unique tmp paths across all concurrent calls within the process. Date.now()
// alone has only millisecond resolution, so Promise.all() of multiple repository
// updates (e.g. bulk assign-playlist-to-screens) could land on the same tmp
// path → fs.rename race → one caller got ENOENT and HTTP 500, while the data
// itself still updated through the shared in-memory cache.
let tmpSeq = 0;

/**
 * Записывает данные в файл атомарно: сначала во временный файл, затем rename.
 * Снижает риск битого JSON при сбое во время записи.
 * @param {string} filePath - полный путь к целевому файлу
 * @param {string} content - строка для записи (например JSON)
 */
async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  const tmpPath = path.join(dir, `.${name}.${process.pid}.${Date.now()}.${tmpSeq++}.tmp`);
  try {
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Записывает объект как JSON в файл атомарно.
 * @param {string} filePath - полный путь к файлу
 * @param {object|Array} data - данные для JSON.stringify
 */
async function writeJsonAtomic(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  await writeFileAtomic(filePath, content);
}

module.exports = { writeFileAtomic, writeJsonAtomic };
