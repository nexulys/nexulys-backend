const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  mois: { type: Number, required: true, min: 1, max: 12 },
  annee: { type: Number, required: true },
  salaireBase: { type: Number, required: true },
  heuresSupplementaires: { type: Number, default: 0 },
  montantHeuresSup: { type: Number, default: 0 },
  primes: { type: Number, default: 0 },
  cotisationsSalariales: {
    securiteSociale: { type: Number, default: 0 },
    retraite: { type: Number, default: 0 },
    assuranceChomage: { type: Number, default: 0 },
    csg: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  cotisationsPatronales: {
    securiteSociale: { type: Number, default: 0 },
    retraite: { type: Number, default: 0 },
    assuranceChomage: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  salaireBrut: { type: Number, required: true },
  salaireNet: { type: Number, required: true },
  statut: {
    type: String,
    enum: ['brouillon', 'valide', 'paye'],
    default: 'brouillon'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Payslip', payslipSchema);
