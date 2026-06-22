const router = require('express').Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const { getAuditLogs } = require('../controllers/auditController');
router.get('/', auth, roles('admin', 'manager'), getAuditLogs);
module.exports = router;
