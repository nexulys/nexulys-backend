const Subscription = require('../models/Subscription');
const {
  createCustomer,
  createSubscription: createStripeSubscription,
  cancelSubscription: cancelStripeSubscription,
  nextBillingOn5th
} = require('../services/stripeService');

exports.getPlans = async (req, res) => {
  res.json({
    success: true,
    data: {
      plateforme: 'Novexa by Nexulys',
      plans: [{
        nom: 'Novexa Pro',
        prix: 2500,
        devise: 'EUR',
        facturation: 'mensuel',
        essaiGratuit: '14 jours',
        fonctionnalites: [
          'Comptabilité IA complète (factures, dépenses, bilan, TVA automatique)',
          'Ressources Humaines IA (employés, contrats, congés, fiches de paie)',
          'Gestion des stocks intelligente (alertes, mouvements, fournisseurs)',
          'Gestion des tâches & projets avec IA',
          'Automatisations métier illimitées',
          'Assistant IA intégré (analyse financière, prédictions stock, conseils RH)',
          'Dashboard insights IA en temps réel',
          'Utilisateurs illimités',
          'Support prioritaire 24/7',
          'Mises à jour incluses',
          'API REST complète'
        ],
        limites: {
          utilisateurs: 'illimité',
          factures: 'illimité',
          employes: 'illimité',
          stockage: '100 Go'
        }
      }]
    }
  });
};

exports.getSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ company: req.user.company });
    if (!sub) return res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    res.json({ success: true, data: sub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.activateSubscription = async (req, res) => {
  try {
    const { methodePaiement, emailFacturation } = req.body;

    // Create Stripe customer and subscription
    const stripeCustomer = await createCustomer({
      email: emailFacturation || req.user.email,
      nom: req.user.nom || req.user.name || '',
      companyName: req.user.companyName || ''
    });
    const stripeSub = await createStripeSubscription(stripeCustomer.id);

    const sub = await Subscription.findOneAndUpdate(
      { company: req.user.company },
      {
        statut: 'actif',
        startDate: new Date(),
        nextBillingDate: nextBillingOn5th(),
        paymentMethod: methodePaiement,
        billingEmail: emailFacturation,
        stripeCustomerId: stripeCustomer.id,
        stripeSubscriptionId: stripeSub.id
      },
      { new: true }
    );
    res.json({
      success: true,
      message: 'Abonnement Novexa Pro activé — 2 500 € / mois',
      data: sub
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ company: req.user.company });
    if (sub && sub.stripeSubscriptionId) {
      await cancelStripeSubscription(sub.stripeSubscriptionId);
    }
    const updatedSub = await Subscription.findOneAndUpdate(
      { company: req.user.company },
      { statut: 'annule', cancelledAt: new Date() },
      { new: true }
    );
    res.json({ success: true, message: 'Abonnement annulé', data: updatedSub });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getBillingHistory = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ company: req.user.company });
    if (!sub) return res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    res.json({ success: true, data: { abonnement: sub, historique: sub.billingHistory || [] } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
