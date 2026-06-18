const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  annee: { type: Number, required: true },
  mois: { type: Number },
  categorie: { type: String },
  type: { type: String, enum: ['recette', 'charge'] },
  montantPrevu: { type: Number },
  montantReel: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Budget', budgetSchema);
