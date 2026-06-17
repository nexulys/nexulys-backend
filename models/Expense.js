const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  titre: { type: String, required: true, trim: true },
  montant: { type: Number, required: true, min: 0 },
  categorie: {
    type: String,
    enum: ['fournitures', 'transport', 'restauration', 'logiciel', 'marketing', 'loyer', 'salaires', 'autre'],
    required: true
  },
  date: { type: Date, default: Date.now },
  description: { type: String },
  justificatif: { type: String },
  statut: {
    type: String,
    enum: ['en_attente', 'approuvee', 'rejetee'],
    default: 'en_attente'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
