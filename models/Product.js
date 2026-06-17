const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true },
  description: { type: String },
  categorie: { type: String },
  quantite: { type: Number, default: 0, min: 0 },
  prixAchat: { type: Number, min: 0 },
  prixVente: { type: Number, min: 0 },
  seuilAlerte: { type: Number, default: 10, min: 0 },
  fournisseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  unite: { type: String, default: 'unité' },
  actif: { type: Boolean, default: true },
  alerteActive: { type: Boolean, default: false }
}, { timestamps: true });

productSchema.index({ company: 1, sku: 1 }, { unique: true });

productSchema.pre('save', function (next) {
  this.alerteActive = this.quantite <= this.seuilAlerte;
  next();
});

module.exports = mongoose.model('Product', productSchema);
