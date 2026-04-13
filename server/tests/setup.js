const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config({ path: '.env.test' });

const connectDB = require('../src/config/db');

let mongoServer;

const DEFAULT_MONGOMS_VERSIONS = ['7.0.14', '7.0.9', '7.0.5'];

function shouldUseExternalMongo() {
  return process.env.USE_EXTERNAL_TEST_DB === 'true' && Boolean(process.env.MONGO_URI);
}

async function createInMemoryMongoServer() {
  const configuredVersion = process.env.MONGOMS_VERSION;
  const versionsToTry = configuredVersion
    ? [configuredVersion]
    : DEFAULT_MONGOMS_VERSIONS;

  const distro = process.env.MONGOMS_DISTRO;
  let lastError;

  for (const version of versionsToTry) {
    try {
      const binary = {
        version,
        ...(distro ? { distro } : {}),
      };

      return await MongoMemoryServer.create({ binary });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';

  if (!shouldUseExternalMongo()) {
    mongoServer = await createInMemoryMongoServer();
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
