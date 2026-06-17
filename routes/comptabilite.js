const router = require('express').Router();
const c = require('../controllers/comptabiliteController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/factures').get(c.getInvoices).post(c.createInvoice);
router.route('/factures/:id').get(c.getInvoice).put(c.updateInvoice).delete(c.deleteInvoice);
router.route('/depenses').get(c.getExpenses).post(c.createExpense);
router.get('/bilan', c.getBilan);

module.exports = router;
