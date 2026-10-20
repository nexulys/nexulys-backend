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
      // Retour de Stripe Checkout : à ce stade le premier paiement est encaissé.
      // C'est le seul endroit où un abonnement devient actif pour la première fois.
      case 'checkout.session.completed': {
        const session = event.data.object;
        const companyId = session.metadata?.companyId;
        if (!companyId) {
          logger.error('Checkout complété sans companyId en métadonnée', { session: session.id });
          break;
        }
        if (session.payment_status !== 'paid') {
          logger.warn('Checkout complété mais non payé — abonnement laissé inactif', {
            session: session.id, payment_status: session.payment_status
          });
          break;
        }
        const maj = await Subscription.findOneAndUpdate(
          { company: companyId },
          {
            statut: 'actif',
            startDate: new Date(),
            nextBillingDate: nextBillingOn5thAfter(Math.floor(Date.now() / 1000)),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription
          },
          { new: true }
        );
        if (maj) logger.info('Abonnement activé après paiement Checkout', { company: companyId, subscription: session.subscription });
        else logger.error('Checkout payé sans abonnement local correspondant', { company: companyId });
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        const nextDate = nextBillingOn5thAfter(inv.created);
        // Idempotence : Stripe réémet un événement tant qu'il n'a pas reçu de 2xx.
        // Le filtre sur l'identifiant de facture évite de dupliquer l'historique
        // de facturation lors d'une reprise.
        const maj = await Subscription.findOneAndUpdate(
          {
            stripeSubscriptionId: inv.subscription,
            'billingHistory.stripeInvoiceId': { $ne: inv.id }
          },
          {
            statut: 'actif',
            startDate: new Date(inv.created * 1000),
            nextBillingDate: nextDate,
            $push: {
              billingHistory: {
                stripeInvoiceId: inv.id,
                date: new Date(inv.created * 1000),
                montant: inv.amount_paid / 100,
                statut: 'payé'
              }
            }
          },
          { new: true }
        );
        if (maj) {
          logger.info('Paiement Stripe encaissé — abonnement activé', {
            subscription: inv.subscription, amount: inv.amount_paid, nextBilling: nextDate
          });
        } else {
          // Soit l'événement est un doublon déjà traité, soit aucun abonnement local
          // ne correspond : le second cas est une incohérence de facturation à examiner.
          const existe = await Subscription.exists({ stripeSubscriptionId: inv.subscription });
          if (!existe) {
            logger.error('Paiement Stripe sans abonnement local correspondant', {
              subscription: inv.subscription, invoice: inv.id
            });
          }
        }
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
