const router = require('express').Router();
const c = require('../controllers/immobilisationController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.route('/').get(c.getImmobilisations).post(c.createImmobilisation);
router.get('/:id/amortissements', c.getAmortissements);
router.route('/:id').put(c.updateImmobilisation).delete(c.deleteImmobilisation);

module.exports = router;
