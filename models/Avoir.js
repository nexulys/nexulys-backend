const mongoose = require('mongoose');

const ligneSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, min: 0 },
  prixUnitaire: { type: Number, required: true, min: 0 },
  montantHT: { type: Number, required: true },
  tva: { type: Number, default: 20 }
}, { _id: false });

const avoirSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  numero: { type: String, required: true, unique: true },
  factureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  factureNumero: { type: String },
  client: {
    nom: { type: String, required: true },
    email: { type: String }
  },
  motif: { type: String, required: true },
  lignes: [ligneSchema],
  montantHT: { type: Number, required: true, default: 0 },
  montantTVA: { type: Number, required: true, default: 0 },
  montantTTC: { type: Number, required: true, default: 0 },
  statut: {
    type: String,
    enum: ['brouillon', 'emis', 'rembourse'],
    default: 'brouillon'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Avoir', avoirSchema);
