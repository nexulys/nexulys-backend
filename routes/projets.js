const router = require('express').Router();
const c = require('../controllers/projetController');
const protect = require('../middleware/auth');

router.use(protect);
router.get('/', c.getProjets);
router.post('/', c.createProjet);
router.put('/:id', c.updateProjet);
router.delete('/:id', c.deleteProjet);
router.get('/:projetId/temps', c.getTimeEntries);
router.post('/temps', c.addTimeEntry);
router.delete('/temps/:id', c.deleteTimeEntry);

module.exports = router;
