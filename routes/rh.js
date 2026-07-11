const router = require('express').Router();
const c = require('../controllers/rhController');
const protect = require('../middleware/auth');
const roles = require('../middleware/roles');
const { validateEmployee } = require('../middleware/validate');

router.use(protect);

// Les données de paie et RH sensibles sont réservées aux rôles de gestion / RH
const rh = roles('admin', 'manager', 'rh');

router.route('/employes').get(c.getEmployees).post(rh, validateEmployee, c.createEmployee);
router.route('/employes/:id').get(c.getEmployee).put(rh, c.updateEmployee).delete(rh, c.deleteEmployee);
router.route('/contrats').get(c.getContracts).post(rh, c.createContract);
router.route('/conges').get(c.getLeaves).post(c.requestLeave);
router.put('/conges/:id/statut', rh, c.updateLeaveStatus);
router.post('/paie/generer', rh, c.generatePayslip);
router.get('/paie/all', rh, c.getAllPayslips);
router.get('/paie/virements/ready', rh, c.getVirementsReady);
router.get('/paie/virements', rh, c.getVirements);
router.post('/paie/virements', rh, c.effectuerVirements);
router.put('/paie/:id/valider', rh, c.validerFiche);
router.get('/paie/:employeeId', rh, c.getPayslips);

// Avances sur salaire
router.get('/avances', c.getAvances);
router.post('/avances', c.createAvance);
router.put('/avances/:id/approuver', c.approuverAvance);
router.put('/avances/:id/rejeter', c.rejeterAvance);
router.put('/avances/:id/rembourser', c.rembourserAvance);
router.delete('/avances/:id', c.deleteAvance);

module.exports = router;
