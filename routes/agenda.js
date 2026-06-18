const router = require('express').Router();
const c = require('../controllers/agendaController');
const protect = require('../middleware/auth');

router.use(protect);

router.get('/echeances-fiscales', c.getEcheancesFiscales);
router.route('/').get(c.getEvenements).post(c.createEvenement);
router.route('/:id').put(c.updateEvenement).delete(c.deleteEvenement);

module.exports = router;
