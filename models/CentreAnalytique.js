const mongoose = require('mongoose');

const centreAnalytiqueSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true },
  code: { type: String },
  couleur: { type: String, default: '#6366f1' },
  description: { type: String },
  budgetAnnuel: { type: Number, default: 0 },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CentreAnalytique', centreAnalytiqueSchema);
