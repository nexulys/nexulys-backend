const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Non autorisé' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'novexa_secret');
    if (!decoded.superAdmin)
      return res.status(403).json({ success: false, message: 'Accès super-admin requis' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token admin invalide ou expiré' });
  }
};
