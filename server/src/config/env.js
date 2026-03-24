require('dotenv').config();

function parseClientUrls() {
  const raw = process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:3000';

  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

module.exports = {
  port: process.env.PORT || 5000,

  nodeEnv: process.env.NODE_ENV || 'development',

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET || 'supersecret',

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  clientUrls: parseClientUrls(),

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
