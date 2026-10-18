const router = require('express').Router();
const c = require('../controllers/projetController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getProjets);
router.post('/', c.createProjet);
router.put('/:id', c.updateProjet);
router.delete('/:id', c.deleteProjet);
// Toutes les saisies de l'entreprise. getTimeEntries ne filtre par projet que si
// :projetId est présent ; sans cette route, l'onglet « Temps » du tableau de bord
// appelait une URL inexistante et affichait toujours une liste vide.
router.get('/temps', c.getTimeEntries);
router.get('/:projetId/temps', c.getTimeEntries);
router.post('/temps', c.addTimeEntry);
router.delete('/temps/:id', c.deleteTimeEntry);

module.exports = router;
