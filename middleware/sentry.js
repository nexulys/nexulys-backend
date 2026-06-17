const logger = require('../utils/logger');

let Sentry = null;

const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    logger.warn('Sentry non configuré (SENTRY_DSN manquant) — monitoring désactivé');
    return false;
  }
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ tracing: true })
      ]
    });
    logger.info('Sentry initialisé', { env: process.env.NODE_ENV });
    return true;
  } catch (err) {
    logger.error('Erreur initialisation Sentry', { error: err.message });
    return false;
  }
};

const requestHandler = (req, res, next) => {
  if (Sentry) return Sentry.Handlers.requestHandler()(req, res, next);
  next();
};

const errorHandler = (err, req, res, next) => {
  if (Sentry) Sentry.Handlers.errorHandler()(err, req, res, next);
  else next(err);
};

const captureException = (err, context = {}) => {
  if (Sentry) Sentry.captureException(err, { extra: context });
};

module.exports = { initSentry, requestHandler, errorHandler, captureException };
