const router = require('express').Router();
const auth = require('../middleware/auth');
const { importClients, importProduits, importEmployes, exportCSV, uploadMiddleware } = require('../controllers/importController');
router.post('/clients', auth, uploadMiddleware, importClients);
router.post('/produits', auth, uploadMiddleware, importProduits);
router.post('/employes', auth, uploadMiddleware, importEmployes);
router.get('/export/:type', auth, exportCSV);
module.exports = router;
