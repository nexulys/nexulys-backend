const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: {
    type: String,
    enum: ['entree', 'sortie', 'ajustement', 'retour'],
    required: true
  },
  quantite: { type: Number, required: true, min: 1 },
  quantiteAvant: { type: Number, required: true },
  quantiteApres: { type: Number, required: true },
  motif: { type: String },
  reference: { type: String },
  fournisseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
