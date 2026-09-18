const mongoose = require('mongoose');
const auditLogSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userNom: { type: String },
  action: { type: String, required: true }, // ex: 'CREATE_INVOICE', 'DELETE_EMPLOYEE', 'APPROVE_LEAVE'
  entity: { type: String, required: true }, // ex: 'Invoice', 'Employee', 'Leave'
  entityId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: String }, // description courte
  ip: { type: String },
  userAgent: { type: String }
}, { timestamps: true });
auditLogSchema.index({ company: 1, createdAt: -1 });

// Purge automatique par index TTL. Ces entrées contiennent une adresse IP et un
// user-agent, donc des données personnelles : sans expiration elles s'accumulaient
// indéfiniment, contrairement au principe de limitation de la conservation
// (RGPD art. 5.1.e). MongoDB s'en charge, sans tâche planifiée à maintenir.
//
// Modifier AUDIT_RETENTION_DAYS ne suffit pas sur une base existante : l'index doit
// être recréé (db.auditlogs.dropIndex('createdAt_1') puis redémarrage).
const RETENTION_JOURS = Number(process.env.AUDIT_RETENTION_DAYS || 365);
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_JOURS * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
