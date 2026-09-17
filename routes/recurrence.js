const router = require('express').Router();
const c = require('../controllers/recurrenceController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getRecurrences);
router.post('/', c.createRecurrence);
router.put('/:id', c.updateRecurrence);
router.delete('/:id', c.deleteRecurrence);
router.post('/generer', c.genererDues);

module.exports = router;
