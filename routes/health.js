const router = require('express').Router();
const mongoose = require('mongoose');
const os = require('os');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[dbState];
  const isHealthy = dbState === 1;

  const health = {
    success: isHealthy,
    platform: 'Novexa by Nexulys',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: { status: dbStatus, healthy: isHealthy },
      openai: { configured: !!process.env.OPENAI_API_KEY },
      stripe: { configured: !!process.env.STRIPE_SECRET_KEY },
      smtp: { configured: !!process.env.SMTP_HOST },
      sentry: { configured: !!process.env.SENTRY_DSN }
    },
    system: {
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
        free: Math.round(os.freemem() / 1024 / 1024) + ' MB',
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024) + ' MB'
      },
      cpu: os.cpus()[0]?.model || 'unknown',
      platform: os.platform(),
      nodeVersion: process.version
    }
  };

  const status = isHealthy ? 200 : 503;
  if (!isHealthy) logger.warn('Health check failed', { dbStatus });

  res.status(status).json(health);
});

// Liveness probe (k8s compatible)
//
// Volontairement lisible depuis n'importe quelle origine. La réponse ne contient qu'un
// booléen, et cette ouverture a une utilité précise : depuis un navigateur, « service
// arrêté » et « origine non autorisée par le CORS » produisent la même erreur
// indifférenciée. Une sonde toujours lisible permet de les distinguer — c'est ce qui
// rend /diagnostic.html capable de nommer la panne au lieu de la deviner.
//
// L'en-tête n'est posé que si la politique CORS n'a rien décidé : remplacer une origine
// explicite par « * » invaliderait les requêtes porteuses d'identifiants.
router.get('/live', (req, res) => {
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Vary', 'Origin');
  }
  // Sans cela, l'en-tête Cross-Origin-Resource-Policy d'helmet bloquerait la lecture.
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.json({ alive: true });
});

// Readiness probe
router.get('/ready', async (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

module.exports = router;
