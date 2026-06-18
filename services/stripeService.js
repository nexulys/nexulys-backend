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

exports.createCustomer = async ({ email, nom, companyName }) => {
  const stripe = getStripe();
  if (!stripe) return { mock: true, id: `cus_mock_${Date.now()}` };
  return stripe.customers.create({ email, name: `${nom} — ${companyName}`, metadata: { companyName } });
};

exports.createSubscription = async (customerId) => {
  const stripe = getStripe();
  if (!stripe) return { mock: true, id: `sub_mock_${Date.now()}`, status: 'active' };

  const product = await stripe.products.create({ name: NOVEXA_PRO_PRICE.product_name });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: NOVEXA_PRO_PRICE.amount,
    currency: NOVEXA_PRO_PRICE.currency,
    recurring: { interval: NOVEXA_PRO_PRICE.interval }
  });

  // Ancrer la facturation au 5 du mois — premier prélèvement le prochain 5
  const billingAnchor = Math.floor(nextBillingOn5th().getTime() / 1000);

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    billing_cycle_anchor: billingAnchor,
    proration_behavior: 'none',
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  });
};

exports.cancelSubscription = async (stripeSubscriptionId) => {
  const stripe = getStripe();
  if (!stripe || !stripeSubscriptionId) return { mock: true, status: 'canceled' };
  return stripe.subscriptions.cancel(stripeSubscriptionId);
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

exports.NOVEXA_PRO_PRICE = NOVEXA_PRO_PRICE;

