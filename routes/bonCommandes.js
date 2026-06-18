const router = require('express').Router();
const c = require('../controllers/bonCommandeController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/').get(c.getBonsCommande).post(c.createBonCommande);
router.route('/:id').put(c.updateBonCommande).delete(c.deleteBonCommande);
router.put('/:id/recevoir', c.recevoirCommande);

module.exports = router;
