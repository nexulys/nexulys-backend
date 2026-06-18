const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  libelle: { type: String, required: true },
  montant: { type: Number, required: true },
  rapproche: { type: Boolean, default: false },
  factureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  depenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }
}, { _id: false });

const rapprochementBancaireSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  banque: { type: String, required: true },
  compte: { type: String, required: true },
  periode: { type: String, required: true },
  soldeOuverture: { type: Number, required: true },
  soldeCloture: { type: Number, required: true },
  transactions: [transactionSchema],
  statut: {
    type: String,
    enum: ['en_cours', 'valide'],
    default: 'en_cours'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('RapprochementBancaire', rapprochementBancaireSchema);
