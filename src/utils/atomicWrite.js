const fs = require('fs').promises;
const path = require('path');

/**
 * Записывает данные в файл атомарно: сначала во временный файл, затем rename.
 * Снижает риск битого JSON при сбое во время записи.
 * @param {string} filePath - полный путь к целевому файлу
 * @param {string} content - строка для записи (например JSON)
 */
async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  // Unique suffix prevents concurrent writes to same file from colliding on the tmp path.
  const tmpPath = path.join(dir, `.${name}.${process.pid}.${Date.now()}.tmp`);
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
