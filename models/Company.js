const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  siret: { type: String, trim: true },
  adresse: { type: String, trim: true },
  ville: { type: String, trim: true },
  codePostal: { type: String, trim: true },
  pays: { type: String, default: 'France' },
  telephone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  siteWeb: { type: String, trim: true },
  secteur: { type: String, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  actif: { type: Boolean, default: true },
  slackWebhookUrl: { type: String },
  approvalThreshold: { type: Number, default: 0 },
  codeApe: { type: String, trim: true },              // code NAF/APE
  urssaf: { type: String, trim: true },               // numéro URSSAF
  conventionCollective: { type: String, trim: true }, // convention collective applicable
  iban: { type: String, trim: true }                  // IBAN entreprise pour virements sortants
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
