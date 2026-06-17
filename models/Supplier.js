const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  contact: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  telephone: { type: String },
  adresse: { type: String },
  siret: { type: String },
  delaiLivraison: { type: Number, default: 7 },
  conditions: { type: String },
  actif: { type: Boolean, default: true },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
