const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entity } = req.query;
    const filter = { company: req.user.company };
    if (action) filter.action = new RegExp(action, 'i');
    if (entity) filter.entity = entity;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(+limit),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ success: true, data: logs, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
