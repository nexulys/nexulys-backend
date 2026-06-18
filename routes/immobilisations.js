const router = require('express').Router();
const c = require('../controllers/immobilisationController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/').get(c.getImmobilisations).post(c.createImmobilisation);
router.get('/:id/amortissements', c.getAmortissements);
router.route('/:id').put(c.updateImmobilisation).delete(c.deleteImmobilisation);

module.exports = router;
