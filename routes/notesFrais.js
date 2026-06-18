const router = require('express').Router();
const c = require('../controllers/notesFraisController');
const protect = require('../middleware/auth');

router.use(protect);
router.get('/', c.getNotesFrais);
router.post('/', c.createNoteFrais);
router.post('/:id/approuver', c.approuverNoteFrais);
router.post('/:id/rejeter', c.rejeterNoteFrais);
router.post('/:id/rembourser', c.rembourserNoteFrais);
router.delete('/:id', c.deleteNoteFrais);

module.exports = router;
