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

exports.createCustomer = async ({ email, nom, companyName }) => {
  const stripe = getStripe();
  if (!stripe) return { mock: true, id: `cus_mock_${Date.now()}` };
  return stripe.customers.create({ email, name: `${nom} — ${companyName}`, metadata: { companyName } });
};

exports.createSubscription = async (customerId) => {
  const stripe = getStripe();
  if (!stripe) return { mock: true, id: `sub_mock_${Date.now()}`, status: 'active' };

  // Create product + price on the fly if needed, or use existing price ID
  const product = await stripe.products.create({ name: NOVEXA_PRO_PRICE.product_name });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: NOVEXA_PRO_PRICE.amount,
    currency: NOVEXA_PRO_PRICE.currency,
    recurring: { interval: NOVEXA_PRO_PRICE.interval }
  });
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    trial_period_days: 14,
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
