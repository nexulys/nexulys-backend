const router = require('express').Router();
const auth = require('../middleware/auth');
const { getExecutiveKPIs } = require('../controllers/dashboardController');
router.get('/executive', auth, getExecutiveKPIs);
module.exports = router;
