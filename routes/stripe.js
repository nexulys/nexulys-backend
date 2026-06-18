const router = require('express').Router();
const express = require('express');
const Subscription = require('../models/Subscription');
const { constructWebhookEvent, nextBillingOn5thAfter } = require('../services/stripeService');
const logger = require('../utils/logger');

// Raw body needed for Stripe signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = constructWebhookEvent(req.body, sig, secret);
    if (!event) return res.json({ received: true, mock: true });
  } catch (err) {
    logger.error('Stripe webhook signature invalide', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        const nextDate = nextBillingOn5thAfter(inv.created);
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: inv.subscription },
          {
            statut: 'actif',
            nextBillingDate: nextDate,
            $push: { billingHistory: { date: new Date(inv.created * 1000), montant: inv.amount_paid / 100, statut: 'payé' } }
          }
        );
        logger.info('Paiement Stripe reçu', { amount: inv.amount_paid, nextBilling: nextDate });
        break;
      }

      case 'invoice.payment_failed':
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: event.data.object.subscription },
          { statut: 'suspendu' }
        );
        logger.warn('Paiement Stripe échoué', { subscriptionId: event.data.object.subscription });
        break;

      case 'customer.subscription.deleted':
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: event.data.object.id },
          { statut: 'annule', cancelledAt: new Date() }
        );
        break;

      default:
        logger.info(`Stripe event ignoré: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Erreur traitement webhook Stripe', { error: err.message });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
