const mongoose = require('mongoose');
const { Schema } = mongoose;

const catalogueSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  description: { type: String },
  reference: { type: String },
  prixUnitaire: { type: Number, required: true, default: 0 },
  tva: { type: Number, default: 20 },
  unite: { type: String, default: 'unité' },
  categorie: { type: String, enum: ['service', 'produit', 'abonnement', 'autre'], default: 'service' },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CatalogueItem', catalogueSchema);
