const router = require('express').Router();
const c = require('../controllers/devisController');
const protect = require('../middleware/auth');
const { resoudreToken } = require('../middleware/accessToken');

// Routes publiques (signature)
router.get('/acces', resoudreToken, c.viewDevis);
router.post('/acces/signer', resoudreToken, c.signerDevis);
router.get('/view/:token', resoudreToken, c.viewDevis);
router.post('/signer/:token', resoudreToken, c.signerDevis);

router.use(protect);
router.get('/', c.getDevis);
router.post('/', c.createDevis);
router.put('/:id', c.updateDevis);
router.delete('/:id', c.deleteDevis);
router.post('/:id/envoyer', c.envoyerDevis);
router.post('/:id/convertir', c.convertirEnFacture);

module.exports = router;
