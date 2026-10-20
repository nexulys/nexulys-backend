const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Cookie httpOnly en priorité, Bearer header en fallback (clients mobiles / API)
    const token = req.cookies?.novexa_token ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Un jeton du back-office (superAdmin) ne doit jamais ouvrir une session applicative :
    // les deux sont signés avec le même secret et seraient sinon interchangeables.
    if (decoded.superAdmin || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (user.actif === false) {
      return res.status(403).json({ success: false, message: 'Compte désactivé' });
    }
    // Jeton émis avant le dernier changement de mot de passe : révoqué.
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ success: false, message: 'Session expirée, reconnectez-vous' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = auth;
module.exports.protect = auth;
