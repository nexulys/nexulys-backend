const mongoose = require('mongoose');
const { champChiffre } = require('../utils/chiffrement');

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
  // Chiffrés au repos : le NIR relève d'un régime particulier et l'IBAN est une
  // donnée bancaire. Déchiffrement transparent à la lecture (fiches de paie, virements).
  numeroSecu: champChiffre(),
  iban: champChiffre(),
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'conge', 'suspendu'],
    default: 'actif'
  },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  tauxImpot: { type: Number, default: 0 }  // taux PAS prélèvement à la source (0 = taux neutre)
}, {
  timestamps: true,
  // Les getters doivent s'appliquer à la sérialisation, sinon l'API renverrait
  // le texte chiffré à la place de la valeur.
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model('Employee', employeeSchema);
