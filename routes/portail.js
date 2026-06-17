const router = require('express').Router();
const c = require('../controllers/portailController');
const protect = require('../middleware/auth');

router.get('/:token', c.viewPortal);
router.post('/:token/payer/:invoiceId', c.payerFacture);
router.use(protect);
router.get('/', c.listPortals);
router.post('/', c.createPortal);

module.exports = router;
