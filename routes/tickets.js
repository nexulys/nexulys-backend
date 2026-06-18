const router = require('express').Router();
const protect = require('../middleware/auth');
const c = require('../controllers/ticketController');

router.use(protect);
router.get('/', c.getTickets);
router.post('/', c.createTicket);
router.put('/:id/statut', c.updateTicketStatut);
router.delete('/:id', c.deleteTicket);

module.exports = router;
