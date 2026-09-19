const router = require('express').Router();
const c = require('../controllers/rapportController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/mensuel', c.getRapportMensuel);
router.post('/envoyer', c.envoyerRapportEmail);

module.exports = router;
