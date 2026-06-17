const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  type: {
    type: String,
    enum: ['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance'],
    required: true
  },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date },
  salaire: { type: Number, required: true },
  poste: { type: String, required: true },
  tempsPartiel: { type: Boolean, default: false },
  pourcentageTemps: { type: Number, default: 100 },
  statut: {
    type: String,
    enum: ['actif', 'expire', 'resilie', 'suspendu'],
    default: 'actif'
  },
  fichier: { type: String },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);
