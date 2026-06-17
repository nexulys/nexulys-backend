const router = require('express').Router();
const c = require('../controllers/comptabiliteController');
const protect = require('../middleware/auth');
const { validateInvoice } = require('../middleware/validate');

router.use(protect);

router.get('/bilan', c.getBilan);
router.get('/bilan-comptable', c.getBilanComptable);
router.get('/compte-resultat', c.getCompteResultat);
router.route('/factures').get(c.getInvoices).post(validateInvoice, c.createInvoice);
router.route('/factures/:id').get(c.getInvoice).put(c.updateInvoice).delete(c.deleteInvoice);
router.route('/depenses').get(c.getExpenses).post(c.createExpense);

module.exports = router;
