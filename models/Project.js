const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  description: { type: String },
  responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  membres: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  statut: {
    type: String,
    enum: ['planifie', 'en_cours', 'en_pause', 'termine', 'annule'],
    default: 'planifie'
  },
  dateDebut: { type: Date },
  dateFin: { type: Date },
  budget: { type: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
