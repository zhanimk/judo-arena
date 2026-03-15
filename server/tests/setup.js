const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

const connectDB = require('../src/config/db');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectDB();
}, 30000);

afterAll(async () => {
  await mongoose.connection.close();
}, 30000);