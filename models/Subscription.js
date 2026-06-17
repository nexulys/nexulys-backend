const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  // Plan name (string for easy reference)
  plan: { type: String, default: 'Novexa Pro' },
  priceMonthly: { type: Number, default: 2500 },
  currency: { type: String, default: 'EUR' },
  features: {
    type: [String],
    default: [
      'Comptabilité IA complète (factures, dépenses, bilan, TVA auto)',
      'Ressources Humaines IA (employés, contrats, congés, fiches de paie)',
      'Gestion des stocks intelligente (alertes, mouvements, fournisseurs)',
      'Gestion des tâches & projets avec IA',
      'Automatisations illimitées',
      'Assistant IA intégré (analyse financière, prédictions stock, RH)',
      'Dashboard insights IA en temps réel',
      'Utilisateurs illimités',
      'Support prioritaire 24/7',
      'Mises à jour incluses'
    ]
  },
  // Support both French (statut) and English (status) field names
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'suspendu', 'annule', 'essai', 'active', 'cancelled', 'trial'],
    default: 'essai'
  },
  status: { type: String },
  dateDebut: { type: Date, default: Date.now },
  startDate: { type: Date },
  dateFin: { type: Date },
  trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  nextBillingDate: { type: Date },
  autoRenouvellement: { type: Boolean, default: true },
  paymentMethod: { type: String },
  billingEmail: { type: String },
  cancelledAt: { type: Date },
  billingHistory: { type: Array, default: [] },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
