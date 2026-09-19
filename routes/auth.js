const router = require('express').Router();
const { register, login, logout, me, updateProfile, forgotPassword, resetPassword, exportMyData, requestAccountDeletion, cancelAccountDeletion, deletionStatus } = require('../controllers/authController');
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
// Effacement RGPD. Volontairement hors du garde d'abonnement : ces droits restent
// exerçables même lorsque l'abonnement est inactif.
router.get('/rgpd/export', protect, exportMyData);
router.post('/rgpd/supprimer', protect, requestAccountDeletion);
router.post('/rgpd/annuler-suppression', protect, cancelAccountDeletion);
router.get('/rgpd/statut-suppression', protect, deletionStatus);

module.exports = router;
