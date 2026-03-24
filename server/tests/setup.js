const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config({ path: '.env.test' });

const connectDB = require('../src/config/db');

let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();

  await connectDB();
}, 60000);

afterEach(async () => {
  const { collections } = mongoose.connection;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.connection.close();

  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);
