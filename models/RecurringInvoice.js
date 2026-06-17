const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, min: 0 },
  prixUnitaire: { type: Number, required: true, min: 0 },
  montantHT: { type: Number, required: true }
}, { _id: false });

const recurringSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  clientNom: { type: String, required: true },
  clientEmail: { type: String },
  lignes: [itemSchema],
  notes: { type: String },
  frequence: { type: String, enum: ['mensuel', 'trimestriel', 'semestriel', 'annuel'], default: 'mensuel' },
  prochainEnvoi: { type: Date, required: true },
  actif: { type: Boolean, default: true },
  facturesGenerees: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('RecurringInvoice', recurringSchema);
