const router = require('express').Router();
const { register, login, me, updateProfile, onboarding, inviteUser } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.put('/me', protect, updateProfile);
router.post('/onboarding', protect, onboarding);
router.post('/invite', protect, inviteUser);

module.exports = router;
