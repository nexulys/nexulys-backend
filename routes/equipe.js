const router = require('express').Router();
const c = require('../controllers/equipeController');
const protect = require('../middleware/auth');
const roles = require('../middleware/roles');

router.use(protect);

// La lecture reste ouverte à tous les membres de l'entreprise ; toute écriture sur
// les comptes (création, changement de rôle, suppression) est réservée aux admins.
router.route('/')
  .get(c.getEquipe)
  .post(roles('admin'), c.inviterMembre);

router.route('/:id')
  .put(roles('admin'), c.updateMembre)
  .delete(roles('admin'), c.supprimerMembre);

module.exports = router;
