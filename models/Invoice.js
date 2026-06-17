const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, min: 0 },
  prixUnitaire: { type: Number, required: true, min: 0 },
  montantHT: { type: Number, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  client: {
    nom: { type: String, required: true },
    email: { type: String },
    adresse: { type: String },
    siret: { type: String }
  },
  lignes: [invoiceItemSchema],
  montantHT: { type: Number, required: true },
  tauxTVA: { type: Number, default: 20 },
  montantTVA: { type: Number, required: true },
  montantTTC: { type: Number, required: true },
  statut: {
    type: String,
    enum: ['brouillon', 'envoyee', 'payee', 'en_retard', 'annulee'],
    default: 'brouillon'
  },
  dateEmission: { type: Date, default: Date.now },
  dateEcheance: { type: Date },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
