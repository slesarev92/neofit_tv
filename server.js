// Digital Signage — NEOFIT TV
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middleware/errorHandler');
const { requireAuth } = require('./src/middleware/auth');

const authRoutes = require('./src/modules/auth/auth.routes');
const mediaRoutes = require('./src/modules/media/media.routes');
const playlistsRoutes = require('./src/modules/playlists/playlists.routes');
const screensRoutes = require('./src/modules/screens/screens.routes');
const playerRoutes = require('./src/modules/player/player.routes');
const settingsRoutes = require('./src/modules/settings/settings.routes');

const app = express();

// Ensure directories exist
const sessionsDir = path.resolve(config.dataDir, 'sessions');
[config.uploadsDir, config.dataDir, sessionsDir].forEach((dir) => {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
    logger.info(`Created directory: ${resolved}`);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  setTimeout(() => process.exit(1), 1000);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

// Initialize auth on first run
const { initAuth } = require('./src/modules/auth/auth.repository');
initAuth().catch((err) => logger.error('Auth init failed', { error: err.message }));

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));

app.use(
  session({
    store: new FileStore({ path: sessionsDir, ttl: config.sessionMaxAge ? Math.floor(config.sessionMaxAge / 1000) : 86400 }),
    secret: config.sessionSecret || 'dev-fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: config.sessionMaxAge,
    },
  })
);

// Корень сайта — редирект в админку (до static, иначе GET / отдаёт 404 из public)
app.get('/', (req, res) => res.redirect('/admin'));
app.get('/admin', (req, res) => res.redirect('/admin/index.html'));

// Скачивание APK — один файл neofit_tv.apk в корне проекта (папка с server.js)
app.get('/neofit_tv.apk', requireAuth, (req, res) => {
  const apkPath = path.join(__dirname, 'neofit_tv.apk');
  if (!fs.existsSync(apkPath)) {
    return res.status(404).send('Файл не найден. Положите neofit_tv.apk в корень проекта (папку с server.js).');
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="neofit_tv.apk"');
  res.setHeader('Cache-Control', 'no-store, no-cache');
  res.sendFile(path.resolve(apkPath));
});

// Public API routes (до static, иначе POST к /api/* отдаёт 404)
app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/pair', require('./src/modules/pair/pair.routes'));

// Protected API routes
app.use('/api/media', requireAuth, mediaRoutes);
app.use('/api/playlists', requireAuth, playlistsRoutes);
app.use('/api/screens', requireAuth, screensRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/system', requireAuth, require('./src/modules/system/system.routes'));
app.use('/api/backup', requireAuth, require('./src/modules/backup/backup.routes'));

// Static files (после API, чтобы POST /api/settings/logo и др. не перехватывались)
app.use('/uploads', express.static(path.resolve(config.uploadsDir), {
  maxAge: '1d',
  setHeaders(res, filePath) {
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=86400');
  },
}));
app.use(express.static(path.resolve('public')));

// Admin paths not served by static fall through to errorHandler
app.get('/admin/*', (req, res, next) => {
  next();
});

app.use(errorHandler);

const screenMonitor = require('./src/modules/screens/screens.monitor');
const videoQueue = require('./src/modules/media/video.queue');
const mediaRepository = require('./src/modules/media/media.repository');
const { compressVideo } = require('./src/modules/media/media.processor');

const settingsRepository = require('./src/modules/settings/settings.repository');
const backupScheduler = require('./src/modules/backup/backup.scheduler');

app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running on 0.0.0.0:${config.port} [${config.nodeEnv}]`);
  settingsRepository.get().then((s) => backupScheduler.startScheduler(s)).catch(() => {});
  screenMonitor.start();
  videoQueue.resumeUnfinished((mediaId) => async (result) => {
    const fs = require('fs').promises;
    if (result.error) {
      await mediaRepository.update(mediaId, { status: 'error', statusMessage: result.error });
    } else {
      await mediaRepository.update(mediaId, { status: 'ready', compressedSize: result.compressedSize });
    }
  }).catch((err) => logger.error('Queue resume failed', { error: err.message }));
});

module.exports = app;
