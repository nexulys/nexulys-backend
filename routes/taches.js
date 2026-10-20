const router = require('express').Router();
const c = require('../controllers/tachesController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const { validateTask } = require('../middleware/validate');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/projets', c.getProjects);
router.post('/projets', c.createProject);
router.get('/automations', c.getAutomations);
router.post('/automations', c.createAutomation);
router.put('/automations/:id/toggle', c.toggleAutomation);

router.route('/').get(c.getTasks).post(validateTask, c.createTask);
router.route('/:id').get(c.getTask).put(c.updateTask).delete(c.deleteTask);

module.exports = router;
