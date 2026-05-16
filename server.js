// Digital Signage — NEOFIT TV
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middleware/errorHandler');
const { requireAuth } = require('./src/middleware/auth');

// Use in-memory session store in development to avoid Windows EPERM/ENOENT with session-file-store
const useMemoryStore = config.nodeEnv !== 'production' || process.env.SESSION_USE_MEMORY === '1';
const FileStore = useMemoryStore ? null : require('session-file-store')(session);
logger.info('Session store: ' + (useMemoryStore ? 'memory' : 'file') + ' (NODE_ENV=' + config.nodeEnv + ', SESSION_USE_MEMORY=' + process.env.SESSION_USE_MEMORY + ')');

const authRoutes = require('./src/modules/auth/auth.routes');
const mediaRoutes = require('./src/modules/media/media.routes');
const playlistsRoutes = require('./src/modules/playlists/playlists.routes');
const screensRoutes = require('./src/modules/screens/screens.routes');
const playerRoutes = require('./src/modules/player/player.routes');
const settingsRoutes = require('./src/modules/settings/settings.routes');

const screenMonitor = require('./src/modules/screens/screens.monitor');
const videoQueue = require('./src/modules/media/video.queue');
const mediaService = require('./src/modules/media/media.service');
const mediaRepository = require('./src/modules/media/media.repository');
const settingsRepository = require('./src/modules/settings/settings.repository');
const backupScheduler = require('./src/modules/backup/backup.scheduler');
const { initAuth } = require('./src/modules/auth/auth.repository');

const app = express();

// Ensure directories exist (sessions dir only needed when using file store)
const sessionsDir = path.resolve(config.dataDir, 'sessions');
[config.uploadsDir, config.dataDir, ...(useMemoryStore ? [] : [sessionsDir])].forEach((dir) => {
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

// Warn if SESSION_SECRET is not set in production
if (config.nodeEnv === 'production' && !config.sessionSecret) {
  logger.error('SESSION_SECRET is not set! Sessions are insecure. Set SESSION_SECRET in .env and restart.');
  process.exit(1);
} else if (!config.sessionSecret) {
  logger.warn('SESSION_SECRET is not set — using insecure fallback (dev only)');
}

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));

app.use(
  session({
    name: 'neofit.sid',
    ...(useMemoryStore ? {} : { store: new FileStore({ path: sessionsDir, ttl: config.sessionMaxAge ? Math.floor(config.sessionMaxAge / 1000) : 86400 }) }),
    secret: config.sessionSecret || 'dev-fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
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

// login.html без кэша, чтобы всегда подхватывалась версия без nav.js (иначе кэш даёт старую страницу с nav.js → 401 → редирект)
app.get('/login.html', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(path.resolve('public'), 'login.html'));
});

// Скачивание APK — brand-aware. Gradle product flavors производят файл вида
// `app-{flavor}-debug.apk` для каждого клуба, и каждый деплой раздаёт свой
// APK в зависимости от своего systemName. Если brand-specific файл не найден,
// fallback на legacy `app-debug.apk` для плавной миграции с одноапочной схемы.
const BRAND_TO_APK = {
  'NeoFit TV': 'app-neofit-debug.apk',
  'Labgym TV': 'app-labgym-debug.apk',
  'Soham TV': 'app-soham-debug.apk',
};

app.get('/app-debug.apk', requireAuth, async (req, res) => {
  let brandApk = null;
  try {
    const settings = await settingsRepository.get();
    const brand = String(settings.systemName || '').trim();
    brandApk = BRAND_TO_APK[brand] || null;
  } catch (err) {
    logger.warn('APK download: settings lookup failed, using legacy', { error: err.message });
  }

  const candidates = [];
  if (brandApk) candidates.push(brandApk);
  candidates.push('app-debug.apk');

  let apkPath = null;
  let chosenName = null;
  for (const name of candidates) {
    const candidate = path.join(__dirname, name);
    if (fs.existsSync(candidate)) {
      apkPath = candidate;
      chosenName = name;
      break;
    }
  }

  if (!apkPath) {
    const expected = brandApk || 'app-debug.apk';
    return res.status(404).send('Файл не найден. Положите ' + expected + ' в корень проекта (папку с server.js).');
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="' + chosenName + '"');
  res.setHeader('Cache-Control', 'no-store, no-cache');
  res.sendFile(path.resolve(apkPath));
});

// Health check (без авторизации — для мониторинга и отображения версии)
// Версию читаем с диска при каждом запросе, чтобы под кнопкой «Выйти» всегда была актуальная
app.get('/api/system/health', (req, res) => {
  let version = '0.0.0';
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version || version;
  } catch (e) { /* ignore */ }
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ ok: true, version, env: config.nodeEnv });
});

// Public branding — used by login/pair/player pages which run without auth.
// Returns ONLY systemName and logoUrl, never secrets. Enables per-deployment
// branding (NeoFit TV / Labgym TV / Soham TV) without exposing protected
// settings to unauthenticated users.
app.get('/api/branding', async (req, res) => {
  try {
    const settings = await settingsRepository.get();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      systemName: settings.systemName || 'NeoFit TV',
      logoUrl: settings.logoUrl || null,
    });
  } catch (err) {
    logger.warn('Branding fetch failed', { error: err.message });
    res.json({ systemName: 'NeoFit TV', logoUrl: null });
  }
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
app.use(express.static(path.resolve('public'), {
  setHeaders(res, filePath) {
    if (!filePath) return;
    const isHtml = filePath.endsWith('.html') || path.basename(filePath) === 'index.html';
    if (!isHtml) return;
    // Player shell must be cacheable so the Android WebView can fall back to
    // cached HTML when the server is unreachable on reboot (offline survival).
    // Admin/login HTML stays uncacheable for security and immediate updates.
    const normalized = filePath.replace(/\\/g, '/');
    const isPlayerShell = normalized.includes('/player/');
    if (isPlayerShell) {
      res.set('Cache-Control', 'public, max-age=3600');
    } else {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  },
}));

// Admin paths not served by static fall through to errorHandler
app.get('/admin/*', (req, res, next) => {
  next();
});

app.use(errorHandler);

// Start listening only after auth is initialized to avoid race where a login
// request arrives before auth.json is read and the default password is set.
initAuth()
  .then(() => {
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on 0.0.0.0:${config.port} [${config.nodeEnv}]`);
      settingsRepository.get().then((s) => backupScheduler.startScheduler(s)).catch(() => {});
      screenMonitor.start();
      // Sweep orphan .tmp.mp4 from a previous crash BEFORE the queue worker
      // starts — otherwise on Linux a stale unlink can race with an in-flight
      // ffmpeg writing the same name and break its final rename.
      mediaService.cleanupStaleTmpFiles()
        .catch((err) => logger.warn('Stale tmp cleanup raised', { error: err.message }))
        .finally(() => {
          videoQueue.resumeUnfinished((mediaId) => async (result) => {
            if (result.error) {
              await mediaRepository.update(mediaId, { status: 'error', statusMessage: result.error });
            } else {
              await mediaRepository.update(mediaId, {
                status: 'ready',
                compressedSize: result.compressedSize,
                ...(result.durationSeconds != null && { durationSeconds: result.durationSeconds }),
              });
            }
          }).catch((err) => logger.error('Queue resume failed', { error: err.message }));
        });
    });
  })
  .catch((err) => {
    logger.error('Auth init failed — cannot start server', { error: err.message });
    process.exit(1);
  });

module.exports = app;
