const mongoose = require('mongoose');
const logger = require('../utils/logger');

mongoose.connection.on('connected', () => logger.info('MongoDB connecté'));
mongoose.connection.on('error', (err) => logger.error('MongoDB erreur', { message: err.message }));
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB déconnecté — reconnexion dans 5s');
  setTimeout(connectDB, 5000);
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
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
