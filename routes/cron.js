const router = require('express').Router();
const { relancerToutesEntreprises } = require('../services/relanceService');
const { envoyerRapportsMensuelsAuto } = require('../services/rapportService');
const { sendError } = require('../utils/errorResponse');
const { secureCompare } = require('../utils/secureCompare');
const logger = require('../utils/logger');

// Garde : les tâches planifiées sont protégées par CRON_SECRET.
// En-tête uniquement — en query string, le secret fuite dans les logs d'accès.
// Comparaison en temps constant pour ne pas exposer le secret par timing.
const cronAuth = (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || !secureCompare(String(secret || ''), process.env.CRON_SECRET)) {
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

// POST /api/cron/rapports — rapport mensuel automatique (toutes entreprises)
router.post('/rapports', cronAuth, async (req, res) => {
  try {
    const result = await envoyerRapportsMensuelsAuto();
    logger.info('Cron rapports exécuté', result);
    res.json({ success: true, data: result });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
