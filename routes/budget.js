const router = require('express').Router();
const protect = require('../middleware/auth');
const c = require('../controllers/budgetController');

router.use(protect);
router.get('/', c.getBudget);
router.post('/', c.createBudget);
router.put('/:id', c.updateBudget);
router.delete('/:id', c.deleteBudget);

module.exports = router;
