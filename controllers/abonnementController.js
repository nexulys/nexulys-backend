const Subscription = require('../models/Subscription');
const Company = require('../models/Company');

const NOVEXA_PLANS = {
  'Novexa Pro': {
    price: 2500,
    currency: 'EUR',
    billing: 'mensuel',
    features: [
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
    ],
    maxUsers: Infinity,
    maxInvoices: Infinity,
    maxEmployees: Infinity
  }
};

exports.getPlans = async (req, res) => {
  res.json({
    success: true,
    data: {
      platform: 'Novexa by Nexulys',
      plans: Object.entries(NOVEXA_PLANS).map(([name, details]) => ({ name, ...details }))
    }
  });
};

exports.getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ company: req.user.company });
    if (!subscription) return res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    res.json({ success: true, data: { ...subscription.toObject(), planDetails: NOVEXA_PLANS[subscription.plan] } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.activateSubscription = async (req, res) => {
  try {
    const { paymentMethod, billingEmail } = req.body;
    const subscription = await Subscription.findOneAndUpdate(
      { company: req.user.company },
      {
        status: 'active',
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentMethod,
        billingEmail
      },
      { new: true }
    );
    res.json({
      success: true,
      message: 'Abonnement Novexa Pro activé — 2 500 €/mois',
      data: subscription
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOneAndUpdate(
      { company: req.user.company },
      { status: 'cancelled', cancelledAt: new Date() },
      { new: true }
    );
    res.json({ success: true, message: 'Abonnement annulé', data: subscription });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getBillingHistory = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ company: req.user.company });
    if (!subscription) return res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    res.json({ success: true, data: { subscription, invoices: subscription.billingHistory || [] } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
