const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

const logAction = async (req, { action, entity, entityId, details }) => {
  try {
    await AuditLog.create({
      company: req.user?.company,
      user: req.user?.id,
      userNom: req.user ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() : 'Système',
      action,
      entity,
      entityId,
      details,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });
  } catch (err) {
    logger.error('AuditLog failed', { error: err.message });
  }
};

module.exports = { logAction };
