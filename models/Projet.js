const mongoose = require('mongoose');
const { Schema } = mongoose;

const projetSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  client: { type: String },
  description: { type: String },
  budget: { type: Number, default: 0 },
  tjm: { type: Number, default: 0 },
  dateDebut: { type: Date },
  dateFin: { type: Date },
  statut: { type: String, enum: ['en_cours', 'en_pause', 'termine', 'annule'], default: 'en_cours' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Projet', projetSchema);
