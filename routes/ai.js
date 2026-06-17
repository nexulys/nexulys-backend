const router = require('express').Router();
const c = require('../controllers/aiController');
const protect = require('../middleware/auth');

router.use(protect);

router.get('/analyse-depenses', c.analyzeExpenses);
router.post('/rh-assistant', c.hrAssistant);
router.get('/prevoir-reapprovisionnement', c.predictReorder);
router.post('/assigner-tache', c.autoAssignTask);
router.get('/dashboard-insights', c.dashboardInsights);

// Comptabilité IA
router.get('/anomalies-comptables', c.detectAnomalies);
router.get('/prevision-tresorerie', c.previsionTresorerie);
router.post('/analyser-facture', c.analyserFacture);

// RH IA
router.post('/scorer-cv', c.scorerCV);
router.post('/generer-offre', c.genererOffre);
router.post('/resumer-entretien', c.resumerEntretien);

module.exports = router;
