const AuditLog = require('../models/AuditLog');
const { sendError } = require('../utils/errorResponse');
const { escapeRegex } = require('../utils/escape');

const MAX_LIMIT = 200;

exports.getAuditLogs = async (req, res) => {
  try {
    const { action, entity } = req.query;
    // Bornes strictes : sans plafond, `?limit=1000000` sature la mémoire du process.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);

    const filter = { company: req.user.company };
    // Motif échappé : `action` vient de la query string, un `(a+)+$` y déclencherait
    // un ReDoS qui fige l'event loop pour tout le serveur.
    if (action) filter.action = new RegExp(escapeRegex(String(action).slice(0, 100)), 'i');
    if (entity) filter.entity = String(entity).slice(0, 100);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ success: true, data: logs, pagination: { page, limit, total } });
  } catch (err) { sendError(res, err); }
};
