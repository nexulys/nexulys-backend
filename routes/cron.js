const router = require('express').Router();
const { relancerToutesEntreprises } = require('../services/relanceService');
const { sendError } = require('../utils/errorResponse');
const logger = require('../utils/logger');

// Garde : les tâches planifiées sont protégées par CRON_SECRET (header ou query)
const cronAuth = (req, res, next) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: 'Secret cron invalide' });
  }
  next();
};

// POST /api/cron/relances — relance automatique des impayés (toutes entreprises)
router.post('/relances', cronAuth, async (req, res) => {
  try {
    const result = await relancerToutesEntreprises();
    logger.info('Cron relances exécuté', result);
    res.json({ success: true, data: result });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
