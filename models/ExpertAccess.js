const mongoose = require('mongoose');

const expertSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  token: { type: String, required: true, unique: true },
  label: { type: String, default: 'Expert-comptable' },
  expiresAt: { type: Date, required: true },
  views: { type: Number, default: 0 },
  lastViewedAt: { type: Date },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ExpertAccess', expertSchema);
