const router = require('express').Router();
const c = require('../controllers/abonnementController');
const { protect } = require('../middleware/auth');

router.get('/plans', c.getPlans);
router.use(protect);
router.get('/', c.getSubscription);
router.post('/activer', c.activateSubscription);
router.post('/annuler', c.cancelSubscription);
router.get('/historique', c.getBillingHistory);

module.exports = router;
