const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  // Identifiant de plan : 'starter' | 'business' | 'pro'
  plan: { type: String, default: 'business' },
  priceMonthly: { type: Number, default: 79 },
  currency: { type: String, default: 'EUR' },
  features: {
    type: [String],
    default: [
      'RH & fiches de paie françaises',
      'Gestion des stocks & fournisseurs',
      'CRM & pipeline commercial',
      'Projets, tâches & notes de frais',
      'Relances de paiement automatiques',
      "Jusqu'à 10 utilisateurs"
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
