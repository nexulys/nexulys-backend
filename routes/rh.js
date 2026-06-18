const router = require('express').Router();
const c = require('../controllers/rhController');
const protect = require('../middleware/auth');
const { validateEmployee } = require('../middleware/validate');

router.use(protect);

router.route('/employes').get(c.getEmployees).post(validateEmployee, c.createEmployee);
router.route('/employes/:id').get(c.getEmployee).put(c.updateEmployee).delete(c.deleteEmployee);
router.route('/contrats').get(c.getContracts).post(c.createContract);
router.route('/conges').get(c.getLeaves).post(c.requestLeave);
router.put('/conges/:id/statut', c.updateLeaveStatus);
router.post('/paie/generer', c.generatePayslip);
router.get('/paie/all', c.getAllPayslips);
router.get('/paie/virements/ready', c.getVirementsReady);
router.get('/paie/virements', c.getVirements);
router.post('/paie/virements', c.effectuerVirements);
router.put('/paie/:id/valider', c.validerFiche);
router.get('/paie/:employeeId', c.getPayslips);

module.exports = router;
