const router = require('express').Router();
const c = require('../controllers/avoirController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.route('/').get(c.getAvoirs).post(c.createAvoir);
router.route('/:id').put(c.updateAvoir).delete(c.deleteAvoir);

module.exports = router;
