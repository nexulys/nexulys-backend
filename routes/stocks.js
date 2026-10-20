const router = require('express').Router();
const c = require('../controllers/stocksController');
const protect = require('../middleware/auth');
const { verifierAbonnement } = require('../middleware/subscription');
const { validateProduct } = require('../middleware/validate');

router.use(protect);

// Écritures réservées aux abonnements actifs (lecture toujours autorisée).
router.use(verifierAbonnement);
router.get('/alertes', c.getLowStockAlerts);
router.route('/produits').get(c.getProducts).post(validateProduct, c.createProduct);
router.route('/produits/:id').get(c.getProduct).put(c.updateProduct).delete(c.deleteProduct);
router.route('/mouvements').get(c.getMovements).post(c.addMovement);
router.route('/fournisseurs').get(c.getSuppliers).post(c.createSupplier);
router.delete('/fournisseurs/:id', c.deleteSupplier);

module.exports = router;
