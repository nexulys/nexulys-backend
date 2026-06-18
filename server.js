require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { apiLimiter, authLimiter, publicLimiter, paymentLimiter, aiLimiter, aiSlowDown } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const { initSentry, requestHandler: sentryRequest, errorHandler: sentryError } = require('./middleware/sentry');
initSentry();

const app = express();

connectDB();

// ── Sécurité HTTP headers ──
app.use(helmet({
  contentSecurityPolicy: false, // désactivé : le dashboard charge Chart.js et Google Fonts depuis des CDN
  crossOriginEmbedderPolicy: false
}));

// ── CORS ──
const corsOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:3000'];
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
  credentials: true
}));

// ── Body parsing avec limite stricte (anti payload flood) ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Timeout global 30s — coupe les connexions lentes/infinies ──
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(408).json({ success: false, message: 'Requête expirée.' });
  });
  next();
});

app.use(morgan('dev', { stream: { write: msg => logger.http(msg.trim()) } }));
app.use(express.static('public'));

// ── Rate limiting global ──
app.use('/api', apiLimiter);
app.use(sentryRequest);

// ── Routes avec limiters spécifiques ──
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/comptabilite', require('./routes/comptabilite'));
app.use('/api/rh', require('./routes/rh'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/taches', require('./routes/taches'));
app.use('/api/ai', aiSlowDown, aiLimiter, require('./routes/ai'));
app.use('/api/abonnement', require('./routes/abonnement'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/recurrence', require('./routes/recurrence'));
app.use('/api/rapport', require('./routes/rapport'));
// Routes publiques — limiter dédié plus restrictif
app.use('/api/expert', publicLimiter, require('./routes/expert'));
app.use('/api/portail', publicLimiter, require('./routes/portail'));
app.use('/api/devis', publicLimiter, require('./routes/devis'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/catalogue', require('./routes/catalogue'));
app.use('/api/projets', require('./routes/projets'));
app.use('/api/notes-frais', require('./routes/notesFrais'));
app.use('/api/avoirs', require('./routes/avoirs'));
app.use('/api/immobilisations', require('./routes/immobilisations'));
app.use('/api/bon-commandes', require('./routes/bonCommandes'));
app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/rapprochement', require('./routes/rapprochement'));
app.use('/api/equipe', require('./routes/equipe'));
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
    message: process.env.NODE_ENV === 'production' ? 'Erreur interne.' : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Novexa by Nexulys démarré sur le port ${PORT}`);
  logger.info(`Docs API: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
