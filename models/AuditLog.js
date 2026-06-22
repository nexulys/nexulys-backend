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
module.exports = mongoose.model('AuditLog', auditLogSchema);
