const mongoose = require('mongoose');

const ligneVirementSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  payslip: { type: mongoose.Schema.Types.ObjectId, ref: 'Payslip' },
  employeeNom: String,
  iban: String,
  montant: { type: Number, default: 0 },
  statut: { type: String, enum: ['effectue', 'sans_iban'], default: 'effectue' }
}, { _id: false });

const virementSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mois: { type: Number, required: true },
  annee: { type: Number, required: true },
  periode: { type: String },
  lignes: [ligneVirementSchema],
  montantTotal: { type: Number, default: 0 },
  nbEmployes: { type: Number, default: 0 },
  statut: { type: String, enum: ['effectue', 'partiel'], default: 'effectue' },
  effectueLe: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Virement', virementSchema);
