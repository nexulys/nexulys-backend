const router = require('express').Router();
const c = require('../controllers/recurrenceController');
const protect = require('../middleware/auth');

router.use(protect);
router.get('/', c.getRecurrences);
router.post('/', c.createRecurrence);
router.put('/:id', c.updateRecurrence);
router.delete('/:id', c.deleteRecurrence);
router.post('/generer', c.genererDues);

module.exports = router;
