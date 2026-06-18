const router = require('express').Router();
const c = require('../controllers/portailController');
const protect = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');

router.get('/:token', c.viewPortal);
router.post('/:token/payer/:invoiceId', paymentLimiter, c.payerFacture);
router.use(protect);
router.get('/', c.listPortals);
router.post('/', c.createPortal);

module.exports = router;
