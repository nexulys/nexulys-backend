const router = require('express').Router();
const auth = require('../middleware/auth');
const { getContrats, createContrat, updateContrat, deleteContrat, getContratsExpirants } = require('../controllers/contratClientController');
router.get('/expirants', auth, getContratsExpirants);
router.get('/', auth, getContrats);
router.post('/', auth, createContrat);
router.put('/:id', auth, updateContrat);
router.delete('/:id', auth, deleteContrat);
module.exports = router;
