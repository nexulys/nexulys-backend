const router = require('express').Router();
const c = require('../controllers/catalogueController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getItems);
router.post('/', c.createItem);
router.put('/:id', c.updateItem);
router.delete('/:id', c.deleteItem);

module.exports = router;
