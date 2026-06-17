const router = require('express').Router();
const c = require('../controllers/stocksController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/produits').get(c.getProducts).post(c.createProduct);
router.route('/produits/:id').get(c.getProduct).put(c.updateProduct).delete(c.deleteProduct);
router.route('/mouvements').get(c.getMovements).post(c.addMovement);
router.route('/fournisseurs').get(c.getSuppliers).post(c.createSupplier);
router.get('/alertes', c.getLowStockAlerts);

module.exports = router;
