const mongoose = require('mongoose');
const { Schema } = mongoose;

const noteFraisSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  employeNom: { type: String, required: true },
  titre: { type: String, required: true },
  montant: { type: Number, required: true, min: 0 },
  categorie: { type: String, enum: ['transport', 'restauration', 'hebergement', 'fournitures', 'autre'], default: 'autre' },
  date: { type: Date, default: Date.now },
  statut: { type: String, enum: ['en_attente', 'approuvee', 'rejetee', 'remboursee'], default: 'en_attente' },
  commentaire: { type: String },
  rembourseLe: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('NoteFrais', noteFraisSchema);
