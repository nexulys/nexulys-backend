const Subscription = require('../models/Subscription');
const { sendError } = require('../utils/errorResponse');
const { PLANS, ESSAI_GRATUIT, getPlan } = require('../config/plans');
const {
  createCustomer,
  createSubscription: createStripeSubscription,
  cancelSubscription: cancelStripeSubscription,
  nextBillingOn5th
} = require('../services/stripeService');

exports.getPlans = async (req, res) => {
  res.json({
    success: true,
    data: { plateforme: 'Novexa by Nexulys', essaiGratuit: ESSAI_GRATUIT, plans: PLANS }
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
    const { methodePaiement, emailFacturation, planId } = req.body;
    const plan = getPlan(planId);

    // Create Stripe customer and subscription (pour le plan choisi)
    const stripeCustomer = await createCustomer({
      email: emailFacturation || req.user.email,
      nom: req.user.nom || req.user.name || '',
      companyName: req.user.companyName || ''
    });
    const stripeSub = await createStripeSubscription(stripeCustomer.id, plan);

    const sub = await Subscription.findOneAndUpdate(
      { company: req.user.company },
      {
        plan: plan.id,
        priceMonthly: plan.prix,
        features: plan.fonctionnalites,
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
      message: `Abonnement ${plan.nom} activé — ${plan.prix} € / mois`,
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
