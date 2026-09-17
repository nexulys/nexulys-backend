const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const onLimitReached = (req, res, options) => {
  const logger = require('../utils/logger');
  logger.warn(`Rate limit hit: ${req.ip} → ${req.method} ${req.originalUrl}`);
};

/**
 * Neutralise les quotas pendant la suite de tests.
 *
 * Les tests d'intégration s'exécutent en un seul processus (--runInBand) et partagent
 * donc le même compteur en mémoire : les 33 appels à /api/auth/* dépassaient la limite
 * de 10 tentatives, et tout ce qui suivait recevait un 429. C'est la cause de l'échec
 * de l'étape « Integration tests » en CI.
 *
 * Positionner TEST_RATE_LIMIT=true réactive les quotas, pour pouvoir écrire un test
 * qui vérifie précisément le comportement de limitation.
 */
const horsTests = () =>
  process.env.NODE_ENV === 'test' && process.env.TEST_RATE_LIMIT !== 'true';

// Global API: 100 req/min
exports.apiLimiter = rateLimit({
  skip: horsTests,
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
  skip: horsTests,
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
  skip: horsTests,
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

// Back-office plateforme : 5 tentatives / heure. Un mot de passe unique (ADMIN_SECRET)
// ouvre les données de TOUS les clients — le quota global de 100 req/min laisserait
// largement la place à une attaque par force brute.
exports.adminLoginLimiter = rateLimit({
  skip: horsTests,
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans une heure.' },
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  }
});

// Paiement Stripe : 5 tentatives / 10 min — évite l'abus de checkout
exports.paymentLimiter = rateLimit({
  skip: horsTests,
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
  skip: horsTests,
  windowMs: 60 * 1000,
  delayAfter: 10,
  delayMs: (used) => (used - 10) * 500  // +500ms par req au-delà de 10
});

// IA : hard limit à 30 req/min
exports.aiLimiter = rateLimit({
  skip: horsTests,
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
