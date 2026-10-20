const Subscription = require('../models/Subscription');
const { sendError } = require('../utils/errorResponse');
const { PLANS, ESSAI_GRATUIT, getPlan } = require('../config/plans');
const { venteActive, MESSAGE_VENTE_FERMEE } = require('../config/vente');
const {
  createCustomer,
  createCheckoutSession,
  cancelSubscription: cancelStripeSubscription
} = require('../services/stripeService');

exports.getPlans = async (req, res) => {
  // `venteActive` est renvoyé au frontend pour qu'il n'affiche jamais un bouton de
  // souscription que l'API refuserait : l'interface et la règle lisent la même source.
  res.json({
    success: true,
    data: {
      plateforme: 'Novexa by Nexulys',
      essaiGratuit: ESSAI_GRATUIT,
      plans: PLANS,
      venteActive: venteActive(),
      messageVenteFermee: venteActive() ? null : MESSAGE_VENTE_FERMEE
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
    if (!venteActive()) {
      // 503 et non 403 : ce n'est pas un refus de droit, c'est un service pas encore
      // ouvert. Le message est celui qu'affichent aussi les pages publiques.
      return res.status(503).json({
        success: false, code: 'VENTE_FERMEE', message: MESSAGE_VENTE_FERMEE
      });
    }
    const { methodePaiement, emailFacturation, planId } = req.body;
    const plan = getPlan(planId);

    // Create Stripe customer and subscription (pour le plan choisi)
    const stripeCustomer = await createCustomer({
      email: emailFacturation || req.user.email,
      nom: req.user.nom || req.user.name || '',
      companyName: req.user.companyName || ''
    });
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const session = await createCheckoutSession({
      customerId: stripeCustomer.id,
      plan,
      companyId: req.user.company,
      appUrl,
      email: emailFacturation || req.user.email
    });

    // L'abonnement n'est PAS activé ici : il ne le sera qu'au retour du webhook, une
    // fois le paiement réellement encaissé. Auparavant, un simple appel à cette route
    // suffisait à obtenir un accès payant sans le moindre encaissement.
    const sub = await Subscription.findOneAndUpdate(
      { company: req.user.company },
      {
        plan: plan.id,
        priceMonthly: plan.prix,
        features: plan.fonctionnalites,
        statut: 'en_attente_paiement',
        paymentMethod: methodePaiement,
        billingEmail: emailFacturation,
        stripeCustomerId: stripeCustomer.id
      },
      { new: true }
    );

    if (!session?.url) {
      return res.status(503).json({
        success: false,
        message: 'Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes.'
      });
    }

    res.json({
      success: true,
      message: `Redirection vers le paiement sécurisé — ${plan.nom}, ${plan.prix} € / mois`,
      data: { abonnement: sub, checkoutUrl: session.url }
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
