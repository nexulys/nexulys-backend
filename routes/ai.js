const router = require('express').Router();
const c = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/analyse-depenses', c.analyzeExpenses);
router.post('/rh-assistant', c.hrAssistant);
router.get('/prevoir-reapprovisionnement', c.predictReorder);
router.post('/assigner-tache', c.autoAssignTasks);
router.get('/dashboard-insights', c.dashboardInsights);

module.exports = router;
