const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  getInfos, transmettreFacture, rafraichirStatut, recevoirFactures
} = require('../controllers/pdpController');

router.get('/infos', auth, getInfos);
router.get('/factures-recues', auth, recevoirFactures);
router.post('/facture/:id/transmettre', auth, transmettreFacture);
router.get('/facture/:id/statut', auth, rafraichirStatut);

module.exports = router;
