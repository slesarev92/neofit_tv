require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  dataDir: process.env.DATA_DIR || './data',
  sessionSecret: process.env.SESSION_SECRET,
  sessionMaxAge: Number(process.env.SESSION_MAX_AGE_MS) || 86400000,
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 500,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD || 'changeme',
};
