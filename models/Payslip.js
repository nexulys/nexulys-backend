const mongoose = require('mongoose');

const ligneCotisationSchema = new mongoose.Schema({
  categorie: { type: String }, // 'Santé', 'Retraite', 'AT/MP', 'Famille', 'Chômage', 'CSG/CRDS', 'Prévoyance'
  libelle: { type: String },
  base: { type: Number, default: 0 },
  tauxSalarial: { type: Number, default: 0 },
  montantSalarial: { type: Number, default: 0 },
  tauxPatronal: { type: Number, default: 0 },
  montantPatronal: { type: Number, default: 0 }
}, { _id: false });

const payslipSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  mois: { type: Number, required: true, min: 1, max: 12 },
  annee: { type: Number, required: true },

  // Période
  periodeDebut: { type: String },
  periodeFin: { type: String },
  numeroBulletin: { type: String },

  // Rémunération
  salaireBase: { type: Number, required: true },
  heuresBase: { type: Number, default: 151.67 },
  tauxHoraire: { type: Number, default: 0 },
  heuresSupplementaires: { type: Number, default: 0 },
  montantHeuresSup: { type: Number, default: 0 },
  primes: { type: Number, default: 0 },
  autresElements: [{ libelle: String, montant: Number }],
  salaireBrut: { type: Number, required: true },

  // Cotisations détaillées (lignes)
  lignesCotisations: [ligneCotisationSchema],

  // Totaux cotisations (compatibilité ancienne API)
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

  // Net
  salaireNet: { type: Number, required: true },      // alias netAvantImpot (compat)
  netAvantImpot: { type: Number, default: 0 },
  netImposable: { type: Number, default: 0 },
  tauxImpot: { type: Number, default: 0 },           // taux PAS (prélèvement à la source)
  montantPAS: { type: Number, default: 0 },
  netAPayer: { type: Number, default: 0 },

  // Congés payés
  congesPayes: {
    soldeEnDebut: { type: Number, default: 0 },
    acquis: { type: Number, default: 2.5 },
    pris: { type: Number, default: 0 },
    solde: { type: Number, default: 2.5 }
  },

  // Statut
  statut: { type: String, enum: ['brouillon', 'valide', 'paye'], default: 'brouillon' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Payslip', payslipSchema);
