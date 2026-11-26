const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let mongoServer;

/**
 * Connects mongoose to an isolated database.
 * Uses MONGODB_TEST_URI if provided, otherwise an in-memory MongoDB instance.
 */
async function connect() {
    let uri = process.env.MONGODB_TEST_URI;
    if (!uri) {
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
    }
    await mongoose.connect(uri);
}

async function clear() {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map(c => c.deleteMany({})));
}

async function disconnect() {
    if (process.env.MONGODB_TEST_URI) {
        await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
}

const validChart = (overrides = {}) => ({
    name: 'Test Chart',
    birthDate: new Date('1990-05-15'),
    birthTime: '10:30',
    birthLocation: 'Santiago, Chile',
    sunSign: 'Taurus',
    moonSign: 'Scorpio',
    risingSign: 'Leo',
    planets: {
        sun: { sign: 'Taurus', degree: 24 },
        moon: { sign: 'Scorpio', degree: 12 },
        mercury: { sign: 'Gemini', degree: 8 },
        venus: { sign: 'Aries', degree: 18 },
        mars: { sign: 'Pisces', degree: 6 }
    },
    isPublic: true,
    ...overrides
});

module.exports = { connect, clear, disconnect, validChart };
