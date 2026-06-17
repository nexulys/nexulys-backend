require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const { initSentry, requestHandler: sentryRequest, errorHandler: sentryError } = require('./middleware/sentry');
initSentry();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const corsOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:3000'];
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev', { stream: { write: msg => logger.http(msg.trim()) } }));
app.use(express.static('public'));
app.use('/api', apiLimiter);
app.use(sentryRequest);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/comptabilite', require('./routes/comptabilite'));
app.use('/api/rh', require('./routes/rh'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/taches', require('./routes/taches'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/abonnement', require('./routes/abonnement'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/recurrence', require('./routes/recurrence'));
app.use('/api/expert', require('./routes/expert'));
app.use('/api/portail', require('./routes/portail'));
app.use('/api/rapport', require('./routes/rapport'));
if (process.env.SEED_SECRET) app.use('/api/seed', require('./routes/seed'));

app.use('/api/health', require('./routes/health'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(sentryError);
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Novexa by Nexulys démarré sur le port ${PORT}`);
  logger.info(`Docs API: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
