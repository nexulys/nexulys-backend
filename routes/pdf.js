const router = require('express').Router();
const auth = require('../middleware/auth');
const { downloadInvoicePDF, downloadPayslipPDF, downloadFacturX } = require('../controllers/pdfController');
router.get('/facture/:id', auth, downloadInvoicePDF);
router.get('/facture/:id/factur-x', auth, downloadFacturX);
router.get('/fiche-paie/:id', auth, downloadPayslipPDF);
module.exports = router;
