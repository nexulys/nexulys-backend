const router = require('express').Router();
const c = require('../controllers/catalogueController');
const protect = require('../middleware/auth');

router.use(protect);
router.get('/', c.getItems);
router.post('/', c.createItem);
router.put('/:id', c.updateItem);
router.delete('/:id', c.deleteItem);

module.exports = router;
