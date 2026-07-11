const Subscription = require('../models/Subscription');
const { sendError } = require('../utils/errorResponse');
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
      essaiGratuit: '14 jours',
      plans: [
        {
          id: 'starter',
          nom: 'Starter',
          prix: 29,
          devise: 'EUR',
          facturation: 'mensuel',
          cible: 'Indépendants & micro-entreprises',
          fonctionnalites: [
            'Facturation & devis illimités',
            'Suivi des dépenses',
            'TVA automatique',
            'Tableau de bord & trésorerie',
            'Export comptable (FEC)',
            '1 utilisateur'
          ],
          limites: { utilisateurs: 1, employes: 0 }
        },
        {
          id: 'business',
          nom: 'Business',
          prix: 79,
          devise: 'EUR',
          facturation: 'mensuel',
          populaire: true,
          cible: 'PME en croissance',
          fonctionnalites: [
            'Tout Starter, plus :',
            'RH & fiches de paie françaises',
            'Gestion des stocks & fournisseurs',
            'CRM & pipeline commercial',
            'Projets, tâches & notes de frais',
            'Relances de paiement automatiques',
            "Jusqu'à 10 utilisateurs"
          ],
          limites: { utilisateurs: 10, employes: 25 }
        },
        {
          id: 'pro',
          nom: 'Pro',
          prix: 199,
          devise: 'EUR',
          facturation: 'mensuel',
          cible: 'Entreprises établies',
          fonctionnalites: [
            'Tout Business, plus :',
            'Assistant IA & copilote proactif',
            'Facturation électronique (Factur-X)',
            'Rôles & permissions avancés',
            'Multi-utilisateurs illimités',
            'API & intégrations',
            'Support prioritaire 24/7'
          ],
          limites: { utilisateurs: 'illimité', employes: 'illimité' }
        }
      ]
    }
  });
};

exports.getSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ company: req.user.company });
    if (!sub) return res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    res.json({ success: true, data: sub });
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
};

exports.getBillingHistory = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ company: req.user.company });
    if (!sub) return res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    res.json({ success: true, data: { abonnement: sub, historique: sub.billingHistory || [] } });
  } catch (err) { sendError(res, err); }
};
