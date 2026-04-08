const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config({ path: '.env.test' });

const connectDB = require('../src/config/db');

let mongoServer;

function shouldUseExternalMongo() {
  return process.env.USE_EXTERNAL_TEST_DB === 'true' && Boolean(process.env.MONGO_URI);
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';

  if (!shouldUseExternalMongo()) {
    const binary = {};

    if (process.env.MONGOMS_VERSION) {
      binary.version = process.env.MONGOMS_VERSION;
    }

    if (process.env.MONGOMS_DISTRO) {
      binary.distro = process.env.MONGOMS_DISTRO;
    }

    mongoServer = await MongoMemoryServer.create({
      binary: Object.keys(binary).length ? binary : undefined,
    });

    process.env.MONGO_URI = mongoServer.getUri();
  }

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
