const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const { adminLoginLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/adminController');

router.post('/login', adminLoginLimiter, c.login);
router.get('/overview', adminAuth, c.getOverview);
router.get('/clients', adminAuth, c.getClients);
router.get('/mrr-chart', adminAuth, c.getMRRChart);
router.get('/payments', adminAuth, c.getPayments);

module.exports = router;
