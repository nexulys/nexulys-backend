const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  getContrats, createContrat, updateContrat, deleteContrat, getContratsExpirants,
  envoyerContratSignature, viewContratPublic, signerContrat
} = require('../controllers/contratClientController');

// Routes publiques de signature (sans authentification)
router.get('/view/:token', viewContratPublic);
router.post('/signer/:token', signerContrat);

router.get('/expirants', auth, getContratsExpirants);
router.get('/', auth, getContrats);
router.post('/', auth, createContrat);
router.put('/:id', auth, updateContrat);
router.delete('/:id', auth, deleteContrat);
router.post('/:id/envoyer-signature', auth, envoyerContratSignature);
module.exports = router;
