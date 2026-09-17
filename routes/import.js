const router = require('express').Router();
const auth = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const { importClients, importProduits, importEmployes, exportCSV, uploadMiddleware } = require('../controllers/importController');
router.post('/clients', auth, verifierAbonnement, uploadMiddleware, importClients);
router.post('/produits', auth, verifierAbonnement, uploadMiddleware, importProduits);
router.post('/employes', auth, verifierAbonnement, uploadMiddleware, importEmployes);
router.get('/export/:type', auth, exportCSV);
module.exports = router;
