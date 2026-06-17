const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nom: { type: String, required: true, trim: true },
  prenom: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  telephone: { type: String },
  poste: { type: String, required: true },
  departement: { type: String },
  salaireBase: { type: Number, required: true, min: 0 },
  dateEmbauche: { type: Date, required: true },
  dateNaissance: { type: Date },
  adresse: { type: String },
  numeroSecu: { type: String },
  iban: { type: String },
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'conge', 'suspendu'],
    default: 'actif'
  },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
