const router = require('express').Router();
const c = require('../controllers/comptabiliteController');
const protect = require('../middleware/auth');
const roles = require('../middleware/roles');
const { validateInvoice } = require('../middleware/validate');

router.use(protect);

// Relance en masse des impayés (réservé gestion / comptabilité)
router.post('/relances/auto', roles('admin', 'manager', 'comptable'), c.relancerImpayees);

router.get('/bilan', c.getBilan);
router.get('/bilan-comptable', c.getBilanComptable);
router.get('/compte-resultat', c.getCompteResultat);
router.get('/scores-clients', c.getScoresClients);
router.get('/settings', c.getSettings);
router.put('/settings', roles('admin', 'manager', 'comptable'), c.updateSettings);
router.route('/factures').get(c.getInvoices).post(validateInvoice, c.createInvoice);
router.route('/factures/:id').get(c.getInvoice).put(c.updateInvoice).delete(c.deleteInvoice);
router.post('/factures/:id/relancer', c.relancerFacture);
router.post('/factures/:id/lien-paiement', c.lienPaiement);
router.route('/depenses').get(c.getExpenses).post(c.createExpense);
router.post('/depenses/:id/approuver', c.approuverDepense);
router.post('/depenses/:id/rejeter', c.rejeterDepense);
router.get('/export-fec', c.exportFEC);
router.get('/declaration-tva', c.getDeclarationTVA);
router.get('/alertes-proactives', c.getAlertesProactives);
router.get('/cashflow', c.getCashflow);
router.get('/calcul-is', c.getCalculIS);
router.get('/dsn', c.getDSN);

module.exports = router;
