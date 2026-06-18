const mongoose = require('mongoose');

const agendaSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  titre: { type: String, required: true, trim: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['reunion', 'echeance', 'fiscal', 'rappel', 'autre'],
    default: 'autre'
  },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date },
  touteLaJournee: { type: Boolean, default: false },
  participants: [{ type: String }],
  lieu: { type: String },
  couleur: { type: String, default: '#6366f1' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Agenda', agendaSchema);
