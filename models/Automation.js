const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  description: { type: String },
  trigger: {
    type: {
      type: String,
      enum: ['facture_en_retard', 'stock_bas', 'tache_deadline', 'conge_en_attente', 'custom'],
      required: true
    },
    conditions: { type: mongoose.Schema.Types.Mixed }
  },
  action: {
    type: {
      type: String,
      enum: ['envoyer_alerte', 'creer_tache', 'notifier_email', 'custom'],
      required: true
    },
    parametres: { type: mongoose.Schema.Types.Mixed }
  },
  actif: { type: Boolean, default: true },
  derniereDeclenchement: { type: Date },
  nombreDeclenchements: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Automation', automationSchema);
