const router = require('express').Router();
const { register, login, logout, me, updateProfile, forgotPassword, resetPassword, exportMyData, requestAccountDeletion } = require('../controllers/authController');
const protect = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/validate');

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/logout', logout);
router.get('/me', protect, me);
router.put('/me', protect, updateProfile);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/rgpd/export', protect, exportMyData);
router.post('/rgpd/supprimer', protect, requestAccountDeletion);

module.exports = router;
