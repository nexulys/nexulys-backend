const mongoose = require('mongoose');

const clientPortalSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  clientNom: { type: String, required: true },
  clientEmail: { type: String },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ClientPortal', clientPortalSchema);
