const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const onLimitReached = (req, res, options) => {
  const logger = require('../utils/logger');
  logger.warn(`Rate limit hit: ${req.ip} → ${req.method} ${req.originalUrl}`);
};

// Global API: 100 req/min
exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Limite de requêtes atteinte. Réessayez dans une minute.' },
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  }
});

// Auth: 10 tentatives / 15 min — anti brute-force
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  }
});

// Routes publiques (portail client, accès expert) : 30 req/min par IP
exports.publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Réessayez dans une minute.' },
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  }
});

// Paiement Stripe : 5 tentatives / 10 min — évite l'abus de checkout
exports.paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de paiement. Réessayez dans 10 minutes.' },
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  }
});

// IA : ralentissement progressif — les appels IA sont coûteux
exports.aiSlowDown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 10,
  delayMs: (used) => (used - 10) * 500  // +500ms par req au-delà de 10
});

// IA : hard limit à 30 req/min
exports.aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Limite IA atteinte. Réessayez dans une minute.' },
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  }
});
