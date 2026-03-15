require('dotenv').config()

module.exports = {
  port: process.env.PORT || 5000,

  nodeEnv: process.env.NODE_ENV || 'development',

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET || 'supersecret',

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  clientUrl: process.env.CLIENT_URL || '*',

  uploadDir: process.env.UPLOAD_DIR || 'uploads'
}