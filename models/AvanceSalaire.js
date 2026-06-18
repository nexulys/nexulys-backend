const mongoose = require('mongoose');

const avanceSalaireSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeNom: { type: String },
  montant: { type: Number, required: true, min: 0 },
  motif: { type: String },
  dateAvance: { type: Date, default: Date.now },
  statut: {
    type: String,
    enum: ['en_attente', 'approuvee', 'remboursee', 'rejetee'],
    default: 'en_attente'
  },
  dateRemboursement: { type: Date },
  deduireDePaie: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AvanceSalaire', avanceSalaireSchema);
