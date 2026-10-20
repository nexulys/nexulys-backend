const router = require('express').Router();
const c = require('../controllers/expertController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const { resoudreToken } = require('../middleware/accessToken');

// Jeton par en-tête X-Access-Token ; la route :token reste pour les liens déjà envoyés.
router.get('/acces', resoudreToken, c.viewAccess);
router.get('/view/:token', resoudreToken, c.viewAccess);
router.use(protect);
// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.listAccess);
router.post('/', c.createAccess);
router.delete('/:id', c.revokeAccess);

module.exports = router;
