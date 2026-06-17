const router = require('express').Router();
const c = require('../controllers/comptabiliteController');
const protect = require('../middleware/auth');
const { validateInvoice } = require('../middleware/validate');

router.use(protect);

router.get('/bilan', c.getBilan);
router.get('/bilan-comptable', c.getBilanComptable);
router.get('/compte-resultat', c.getCompteResultat);
router.get('/scores-clients', c.getScoresClients);
router.get('/settings', c.getSettings);
router.put('/settings', c.updateSettings);
router.route('/factures').get(c.getInvoices).post(validateInvoice, c.createInvoice);
router.route('/factures/:id').get(c.getInvoice).put(c.updateInvoice).delete(c.deleteInvoice);
router.post('/factures/:id/relancer', c.relancerFacture);
router.route('/depenses').get(c.getExpenses).post(c.createExpense);
router.post('/depenses/:id/approuver', c.approuverDepense);
router.post('/depenses/:id/rejeter', c.rejeterDepense);

module.exports = router;
