const logger = require('../utils/logger');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn('Stripe non configuré — paiements désactivés');
    return null;
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

const NOVEXA_PRO_PRICE = {
  amount: 250000, // 2500€ en centimes
  currency: 'eur',
  interval: 'month',
  product_name: 'Novexa Pro'
};

// Retourne la prochaine date de prélèvement : le 5 du mois courant si futur, sinon le 5 du mois suivant
const nextBillingOn5th = () => {
  const now = new Date();
  let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5, 0, 0, 0));
  if (d <= now) d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 5, 0, 0, 0));
  return d;
};
exports.nextBillingOn5th = nextBillingOn5th;

// Retourne le 5 du mois suivant un timestamp Stripe (pour nextBillingDate après paiement)
const nextBillingOn5thAfter = (unixTimestamp) => {
  const d = new Date(unixTimestamp * 1000);
  return new Date(Date.UTC(
    d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(),
    d.getUTCMonth() === 11 ? 0 : d.getUTCMonth() + 1,
    5, 0, 0, 0
  ));
};
exports.nextBillingOn5thAfter = nextBillingOn5thAfter;

/**
 * Erreur de facturation — distingue une panne Stripe d'un bug applicatif, pour que
 * l'appelant réponde 503 plutôt que d'inventer un abonnement.
 */
class StripeIndisponibleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StripeIndisponibleError';
    this.status = 503;
  }
}
exports.StripeIndisponibleError = StripeIndisponibleError;

// Le repli « mock » ne doit jamais servir en production : il faisait passer une panne
// Stripe pour un abonnement actif, donc un accès payant accordé sans encaissement.
const modeDemoAutorise = () => process.env.NODE_ENV !== 'production';

exports.createCustomer = async ({ email, nom, companyName }) => {
  const stripe = getStripe();
  if (!stripe) {
    if (!modeDemoAutorise()) throw new StripeIndisponibleError('Facturation non configurée (STRIPE_SECRET_KEY manquante).');
    return { mock: true, id: `cus_mock_${Date.now()}` };
  }
  try {
    return await stripe.customers.create({ email, name: `${nom} — ${companyName}`, metadata: { companyName } });
  } catch (err) {
    logger.error('Stripe : création client échouée', { error: err.message });
    if (!modeDemoAutorise()) throw new StripeIndisponibleError('Service de paiement momentanément indisponible.');
    return { mock: true, id: `cus_mock_${Date.now()}` };
  }
};


/**
 * Session Stripe Checkout en mode abonnement.
 * Stripe héberge la page de paiement : l'authentification forte (DSP2/SCA) et les
 * moyens de paiement sont gérés chez lui, aucune donnée de carte ne transite ici.
 * L'abonnement local n'est activé qu'au retour du webhook.
 */
exports.createCheckoutSession = async ({ customerId, plan, companyId, appUrl, email }) => {
  const stripe = getStripe();
  if (!stripe) {
    if (!modeDemoAutorise()) throw new StripeIndisponibleError('Facturation non configurée (STRIPE_SECRET_KEY manquante).');
    return { mock: true, url: null };
  }
  try {
    return await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId || undefined,
      customer_email: customerId ? undefined : email,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round((plan?.prix ?? 0) * 100),
          recurring: { interval: 'month' },
          product_data: { name: `Novexa ${plan?.nom || ''}`.trim() }
        },
        quantity: 1
      }],
      // Rattache la session à l'entreprise : le webhook s'en sert pour activer le
      // bon abonnement, sans se fier à un identifiant fourni par le client.
      metadata: { companyId: String(companyId), planId: String(plan?.id || '') },
      subscription_data: { metadata: { companyId: String(companyId), planId: String(plan?.id || '') } },
      success_url: `${appUrl}/dashboard.html?abonnement=succes`,
      cancel_url: `${appUrl}/dashboard.html?abonnement=annule`
    });
  } catch (err) {
    logger.error('Stripe : création session Checkout échouée', { error: err.message });
    if (!modeDemoAutorise()) throw new StripeIndisponibleError('Service de paiement momentanément indisponible.');
    return { mock: true, url: null };
  }
};

exports.cancelSubscription = async (stripeSubscriptionId) => {
  const stripe = getStripe();
  if (!stripe || !stripeSubscriptionId || stripeSubscriptionId.startsWith('sub_mock')) {
    return { mock: true, status: 'canceled' };
  }
  try {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  } catch (err) {
    logger.warn('Stripe cancelSubscription échoué', { error: err.message });
    return { mock: true, status: 'canceled' };
  }
};

exports.createPaymentIntent = async () => {
  const stripe = getStripe();
  if (!stripe) return { mock: true, client_secret: 'mock_secret', amount: NOVEXA_PRO_PRICE.amount };
  return stripe.paymentIntents.create({
    amount: NOVEXA_PRO_PRICE.amount,
    currency: NOVEXA_PRO_PRICE.currency,
    metadata: { product: 'Novexa Pro' }
  });
};

exports.constructWebhookEvent = (payload, sig, secret) => {
  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.webhooks.constructEvent(payload, sig, secret);
};

// Crée un lien de paiement Stripe pour une facture (montant TTC en centimes).
// Retourne null si Stripe n'est pas configuré (dégradation propre).
exports.createInvoicePaymentLink = async ({ numero, montantTTC, clientEmail }) => {
  const stripe = getStripe();
  if (!stripe) return null;
  const price = await stripe.prices.create({
    unit_amount: Math.round((Number(montantTTC) || 0) * 100),
    currency: 'eur',
    product_data: { name: `Facture ${numero}` }
  });
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { facture: numero, clientEmail: clientEmail || '' }
  });
  return link.url;
};

exports.NOVEXA_PRO_PRICE = NOVEXA_PRO_PRICE;

