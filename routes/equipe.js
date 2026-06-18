const router = require('express').Router();
const c = require('../controllers/equipeController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/').get(c.getEquipe).post(c.inviterMembre);
router.route('/:id').put(c.updateMembre).delete(c.supprimerMembre);

module.exports = router;
