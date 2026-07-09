const mongoose = require('mongoose');
const logger = require('../utils/logger');

let reconnectScheduled = false; // évite d'empiler plusieurs boucles de reconnexion

const scheduleReconnect = () => {
  if (process.env.NODE_ENV === 'test') return; // pas de boucle en environnement de test
  if (reconnectScheduled) return;
  reconnectScheduled = true;
  setTimeout(() => { reconnectScheduled = false; connectDB(); }, 5000);
};

mongoose.connection.on('connected', () => logger.info('MongoDB connecté'));
mongoose.connection.on('error', (err) => logger.error('MongoDB erreur', { message: err.message }));
mongoose.connection.on('disconnected', () => {
  if (process.env.NODE_ENV === 'test') return;
  logger.warn('MongoDB déconnecté — reconnexion dans 5s');
  scheduleReconnect();
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/novexa', {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    logger.error('MongoDB connection error: ' + err.message);
    logger.warn('Nouvelle tentative dans 5s...');
    scheduleReconnect();
  }
};

module.exports = connectDB;
