const router = require('express').Router();
const c = require('../controllers/agendaController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/echeances-fiscales', c.getEcheancesFiscales);
router.route('/').get(c.getEvenements).post(c.createEvenement);
router.route('/:id').put(c.updateEvenement).delete(c.deleteEvenement);

module.exports = router;
