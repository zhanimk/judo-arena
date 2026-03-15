const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || env.mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);

    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }

    throw error;
  }
}

module.exports = connectDB;


// const mongoose = require('mongoose');
// const env = require('./env');

// async function connectDB() {
//   try {
//     await mongoose.connect(env.mongoUri);
//     console.log(`MongoDB connected: ${mongoose.connection.host}`);
//   } catch (error) {
//     console.error('MongoDB connection error:', error.message);
//     process.exit(1);
//   }
// }

// module.exports = connectDB;
