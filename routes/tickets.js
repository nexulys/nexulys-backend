const router = require('express').Router();
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const c = require('../controllers/ticketController');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/', c.getTickets);
router.post('/', c.createTicket);
router.put('/:id/statut', c.updateTicketStatut);
router.delete('/:id', c.deleteTicket);

module.exports = router;
