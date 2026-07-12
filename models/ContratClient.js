const mongoose = require('mongoose');
const contratClientSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  reference: { type: String },
  client: {
    nom: { type: String, required: true },
    email: { type: String },
    entreprise: { type: String }
  },
  titre: { type: String, required: true },
  type: { type: String, enum: ['service', 'maintenance', 'abonnement', 'prestation', 'autre'], default: 'service' },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date },
  valeur: { type: Number, default: 0 },
  periodicite: { type: String, enum: ['unique', 'mensuel', 'trimestriel', 'annuel'], default: 'unique' },
  statut: { type: String, enum: ['actif', 'expire', 'resilie', 'en_negociation', 'renouvellement_prevu'], default: 'actif' },
  alerteRenouvellement: { type: Number, default: 30 }, // jours avant fin
  notes: { type: String },
  // Signature électronique
  signatureToken: { type: String },
  signe: { type: Boolean, default: false },
  signataire: { type: String },
  signedAt: { type: Date },
  signatureIP: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
contratClientSchema.index({ company: 1, dateFin: 1 });

// Numérotation automatique
contratClientSchema.pre('save', async function() {
  if (!this.reference) {
    const count = await this.constructor.countDocuments({ company: this.company });
    this.reference = `CC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('ContratClient', contratClientSchema);
