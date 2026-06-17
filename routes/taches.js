const router = require('express').Router();
const c = require('../controllers/tachesController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Static routes must come before dynamic /:id route
router.route('/projets').get(c.getProjects).post(c.createProject);
router.route('/automations').get(c.getAutomations).post(c.createAutomation);
router.put('/automations/:id/toggle', c.toggleAutomation);

router.route('/').get(c.getTasks).post(c.createTask);
router.route('/:id').get(c.getTask).put(c.updateTask).delete(c.deleteTask);

module.exports = router;
