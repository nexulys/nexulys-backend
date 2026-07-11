require('dotenv').config();

// ── Vérifications critiques au démarrage ──
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non défini. Arrêt du serveur.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  console.warn('WARNING: ALLOWED_ORIGINS non défini en production — le CORS bloquera les requêtes frontend.');
}

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { apiLimiter, authLimiter, publicLimiter, paymentLimiter, aiLimiter, aiSlowDown } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const { initSentry, requestHandler: sentryRequest, errorHandler: sentryError } = require('./middleware/sentry');
initSentry();

const app = express();

// En test, la connexion est gérée par le harnais (mongodb-memory-server)
if (process.env.NODE_ENV !== 'test') connectDB();

// ── Sécurité HTTP headers + CSP ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://nexulys-backend-1.onrender.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
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

// ── Cookie parser ──
app.use(cookieParser());

// ── Body parsing avec limite stricte (anti payload flood) ──
// IMPORTANT : le webhook Stripe a besoin du corps brut pour vérifier la signature.
// On l'exclut du parsing JSON global (sinon la signature échoue systématiquement).
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next();
  express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Sanitisation NoSQL — supprime les opérateurs MongoDB ($) des inputs ──
const { sanitizeMiddleware } = require('./utils/sanitize');
app.use(sanitizeMiddleware);

// ── Timeout global 30s — coupe les connexions lentes/infinies ──
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(408).json({ success: false, message: 'Requête expirée.' });
  });
  next();
});

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: { write: msg => logger.http(msg.trim()) } }));
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
app.use('/api/budget', require('./routes/budget'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/centres-analytiques', require('./routes/centresAnalytiques'));
if (process.env.SEED_SECRET) app.use('/api/seed', require('./routes/seed'));

app.use('/api/health', require('./routes/health'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/import', require('./routes/import'));
app.use('/api/contrats-clients', require('./routes/contratsClients'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/entreprise', require('./routes/entreprise'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler — filet de sécurité pour toute erreur non capturée par un contrôleur
const { sendError } = require('./utils/errorResponse');
app.use(sentryError);
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  // Erreurs avec statut explicite (ex. payload trop volumineux) : on le respecte
  if (err.status && err.status !== 500) {
    return res.status(err.status).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Requête invalide.' : err.message
    });
  }
  // Sinon on applique le même mapping que les contrôleurs (ValidationError -> 400, etc.)
  sendError(res, err);
});

// En test, on n'ouvre pas de port réseau (supertest utilise l'objet app directement)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`Novexa by Nexulys démarré sur le port ${PORT}`);
    logger.info(`Docs API: http://localhost:${PORT}/api/docs`);
  });
}

module.exports = app;
