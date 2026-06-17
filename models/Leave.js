const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  type: {
    type: String,
    enum: ['conge_paye', 'maladie', 'maternite', 'paternite', 'sans_solde', 'rtt', 'autre'],
    required: true
  },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, required: true },
  nombreJours: { type: Number, required: true },
  motif: { type: String },
  statut: {
    type: String,
    enum: ['en_attente', 'approuve', 'rejete', 'annule'],
    default: 'en_attente'
  },
  commentaireRH: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
