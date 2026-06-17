const router = require('express').Router();
const { register, login, me, updateProfile } = require('../controllers/authController');
const protect = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.put('/me', protect, updateProfile);

module.exports = router;
