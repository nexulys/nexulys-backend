const router = require('express').Router();
const c = require('../controllers/rhController');
const protect = require('../middleware/auth');

router.use(protect);

router.route('/employes').get(c.getEmployees).post(c.createEmployee);
router.route('/employes/:id').get(c.getEmployee).put(c.updateEmployee).delete(c.deleteEmployee);
router.route('/contrats').get(c.getContracts).post(c.createContract);
router.route('/conges').get(c.getLeaves).post(c.requestLeave);
router.put('/conges/:id/statut', c.updateLeaveStatus);
router.post('/paie/generer', c.generatePayslip);
router.get('/paie/:employeeId', c.getPayslips);

module.exports = router;
