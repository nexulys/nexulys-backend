const router = require('express').Router();
const c = require('../controllers/avoirController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/').get(c.getAvoirs).post(c.createAvoir);
router.route('/:id').put(c.updateAvoir).delete(c.deleteAvoir);

module.exports = router;
