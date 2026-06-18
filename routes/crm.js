const router = require('express').Router();
const c = require('../controllers/crmController');
const protect = require('../middleware/auth');

router.use(protect);
router.get('/kpis', c.getKPIs);
router.get('/', c.getProspects);
router.post('/', c.createProspect);
router.put('/:id', c.updateProspect);
router.delete('/:id', c.deleteProspect);

module.exports = router;
