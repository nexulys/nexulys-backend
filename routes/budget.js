const router = require('express').Router();
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const c = require('../controllers/budgetController');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getBudget);
router.post('/', c.createBudget);
router.put('/:id', c.updateBudget);
router.delete('/:id', c.deleteBudget);

module.exports = router;
