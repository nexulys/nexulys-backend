const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

/**
 * Connecte Mongoose à une base de test.
 * - Si MONGODB_URI est fourni (service MongoDB de la CI), on l'utilise directement.
 * - Sinon, on démarre une instance MongoDB en mémoire (local / CI sans service).
 */
const connect = async () => {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
};

/** Vide toutes les collections entre les tests. */
const clear = async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

/** Ferme la connexion et arrête le serveur mémoire. */
const close = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
};

module.exports = { connect, clear, close };
