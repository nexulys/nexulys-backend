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
router.get('/live', (req, res) => res.json({ alive: true }));

// Readiness probe
router.get('/ready', async (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

module.exports = router;
