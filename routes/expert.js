const router = require('express').Router();
const c = require('../controllers/expertController');
const protect = require('../middleware/auth');

router.get('/view/:token', c.viewAccess);
router.use(protect);
router.get('/', c.listAccess);
router.post('/', c.createAccess);
router.delete('/:id', c.revokeAccess);

module.exports = router;
