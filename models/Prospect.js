const mongoose = require('mongoose');
const { Schema } = mongoose;

const prospectSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  telephone: { type: String },
  entreprise: { type: String },
  statut: { type: String, enum: ['prospect', 'contact', 'negociation', 'gagne', 'perdu'], default: 'prospect' },
  valeurEstimee: { type: Number, default: 0 },
  probabilite: { type: Number, default: 50, min: 0, max: 100 },
  source: { type: String, enum: ['inbound', 'referral', 'cold', 'reseaux', 'autre'], default: 'autre' },
  notes: { type: String },
  prochainContact: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Prospect', prospectSchema);
