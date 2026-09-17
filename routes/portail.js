const router = require('express').Router();
const c = require('../controllers/portailController');
const protect = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { resoudreToken } = require('../middleware/accessToken');

// Accès client : jeton par en-tête X-Access-Token (il ne transite plus dans l'URL,
// où il serait journalisé par nginx et morgan).
router.get('/acces', resoudreToken, c.viewPortal);
router.post('/acces/payer/:invoiceId', paymentLimiter, resoudreToken, c.payerFacture);

// Compatibilité : liens déjà envoyés aux clients, non révocables.
router.get('/:token', resoudreToken, c.viewPortal);
router.post('/:token/payer/:invoiceId', paymentLimiter, resoudreToken, c.payerFacture);

router.use(protect);
router.get('/', c.listPortals);
router.post('/', c.createPortal);

module.exports = router;
