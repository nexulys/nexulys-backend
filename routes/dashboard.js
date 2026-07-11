const router = require('express').Router();
const auth = require('../middleware/auth');
const { getExecutiveKPIs, getHealthScore } = require('../controllers/dashboardController');
router.get('/executive', auth, getExecutiveKPIs);
router.get('/sante', auth, getHealthScore);
module.exports = router;
