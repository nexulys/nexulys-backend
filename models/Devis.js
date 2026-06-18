const mongoose = require('mongoose');
const { Schema } = mongoose;

const ligneSchema = new Schema({
  description: { type: String, required: true },
  quantite: { type: Number, default: 1, min: 0 },
  prixUnitaire: { type: Number, default: 0 },
  tva: { type: Number, default: 20 },
  montantHT: { type: Number, default: 0 }
}, { _id: false });

const devisSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  numero: { type: String, required: true },
  client: {
    nom: { type: String, required: true },
    email: { type: String },
    adresse: { type: String }
  },
  lignes: [ligneSchema],
  montantHT: { type: Number, default: 0 },
  montantTVA: { type: Number, default: 0 },
  montantTTC: { type: Number, default: 0 },
  notes: { type: String },
  statut: { type: String, enum: ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'], default: 'brouillon' },
  dateValidite: { type: Date },
  devise: { type: String, default: 'EUR' },
  tauxChange: { type: Number, default: 1 },
  signatureToken: { type: String, unique: true, sparse: true },
  signedAt: { type: Date },
  signatureIP: { type: String },
  factureId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Devis', devisSchema);
