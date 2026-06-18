const router = require('express').Router();
const protect = require('../middleware/auth');
const c = require('../controllers/centreAnalytiqueController');

router.use(protect);
router.get('/', c.getCentres);
router.post('/', c.createCentre);
router.put('/:id', c.updateCentre);
router.delete('/:id', c.deleteCentre);

module.exports = router;
