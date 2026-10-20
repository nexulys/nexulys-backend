const router = require('express').Router();
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const c = require('../controllers/centreAnalytiqueController');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getCentres);
router.post('/', c.createCentre);
router.put('/:id', c.updateCentre);
router.delete('/:id', c.deleteCentre);

module.exports = router;
