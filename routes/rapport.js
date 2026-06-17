const router = require('express').Router();
const c = require('../controllers/rapportController');
const protect = require('../middleware/auth');

router.use(protect);
router.get('/mensuel', c.getRapportMensuel);
router.post('/envoyer', c.envoyerRapportEmail);

module.exports = router;
