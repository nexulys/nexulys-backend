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
  try {
    return await stripe.customers.create({ email, name: `${nom} — ${companyName}`, metadata: { companyName } });
  } catch (err) {
    logger.warn('Stripe injoignable — mode mock activé', { error: err.message });
    return { mock: true, id: `cus_mock_${Date.now()}` };
  }
};

exports.createSubscription = async (customerId, plan) => {
  const stripe = getStripe();
  if (!stripe || (customerId && customerId.startsWith('cus_mock'))) {
    return { mock: true, id: `sub_mock_${Date.now()}`, status: 'active' };
  }
  try {
    const nom = plan?.nom ? `Novexa ${plan.nom}` : NOVEXA_PRO_PRICE.product_name;
    const montant = plan?.prix != null ? Math.round(plan.prix * 100) : NOVEXA_PRO_PRICE.amount;
    const product = await stripe.products.create({ name: nom });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: montant,
      currency: 'eur',
      recurring: { interval: 'month' }
    });
    const billingAnchor = Math.floor(nextBillingOn5th().getTime() / 1000);
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      billing_cycle_anchor: billingAnchor,
      proration_behavior: 'none',
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
  } catch (err) {
    logger.warn('Stripe injoignable — mode mock activé', { error: err.message });
    return { mock: true, id: `sub_mock_${Date.now()}`, status: 'active' };
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

