const router = require('express').Router();
const auth = require('../middleware/auth');
const { resoudreToken } = require('../middleware/accessToken');
const {
  getContrats, createContrat, updateContrat, deleteContrat, getContratsExpirants,
  envoyerContratSignature, viewContratPublic, signerContrat
} = require('../controllers/contratClientController');

// Routes publiques de signature (sans authentification)
router.get('/acces', resoudreToken, viewContratPublic);
router.get('/view/:token', resoudreToken, viewContratPublic);
router.post('/acces/signer', resoudreToken, signerContrat);
router.post('/signer/:token', resoudreToken, signerContrat);

router.get('/expirants', auth, getContratsExpirants);
router.get('/', auth, getContrats);
router.post('/', auth, createContrat);
router.put('/:id', auth, updateContrat);
router.delete('/:id', auth, deleteContrat);
router.post('/:id/envoyer-signature', auth, envoyerContratSignature);
module.exports = router;
