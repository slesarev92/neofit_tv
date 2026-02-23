require('dotenv').config();

const baseUrl = (process.env.BASE_URL || '').trim();
module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl,
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  dataDir: process.env.DATA_DIR || './data',
  sessionSecret: process.env.SESSION_SECRET,
  sessionMaxAge: Number(process.env.SESSION_MAX_AGE_MS) || 86400000,
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 500,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD || 'changeme',
  /** Cookie secure only when served over HTTPS (BASE_URL starts with https). */
  cookieSecure: baseUrl.startsWith('https'),
};
