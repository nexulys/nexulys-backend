const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  titre: { type: String },
  description: { type: String },
  categorie: {
    type: String,
    enum: ['technique', 'rh', 'comptabilite', 'autre'],
    default: 'autre'
  },
  priorite: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale'
  },
  statut: {
    type: String,
    enum: ['ouvert', 'en_cours', 'resolu', 'ferme'],
    default: 'ouvert'
  },
  rapporteurNom: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
