const router = require('express').Router();
const c = require('../controllers/rapprochementController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/').get(c.getRapprochements).post(c.createReleve);
router.put('/:id/valider', c.validerReleve);
router.delete('/:id', c.deleteReleve);
router.put('/:releveId/transactions/:idx/rapprocher', c.rapprochierTransaction);

module.exports = router;
