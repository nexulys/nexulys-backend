const router = require('express').Router();
const c = require('../controllers/notesFraisController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getNotesFrais);
router.post('/', c.createNoteFrais);
router.post('/:id/approuver', c.approuverNoteFrais);
router.post('/:id/rejeter', c.rejeterNoteFrais);
router.post('/:id/rembourser', c.rembourserNoteFrais);
router.delete('/:id', c.deleteNoteFrais);

module.exports = router;
