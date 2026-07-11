const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/entrepriseController');

router.get('/recherche', auth, c.rechercher);

module.exports = router;
