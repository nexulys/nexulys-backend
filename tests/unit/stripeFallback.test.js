/**
 * Le repli « mock » de Stripe faisait passer une panne de paiement pour un
 * abonnement actif : un accès payant était accordé sans le moindre encaissement.
 * Ces tests verrouillent le comportement attendu en production : échouer, jamais simuler.
 */
const NODE_ENV_INITIAL = process.env.NODE_ENV;
const CLE_INITIALE = process.env.STRIPE_SECRET_KEY;

const chargerService = () => {
  jest.resetModules();
  return require('../../services/stripeService');
};

afterEach(() => {
  process.env.NODE_ENV = NODE_ENV_INITIAL;
  if (CLE_INITIALE === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = CLE_INITIALE;
});

describe('Stripe non configuré — en production', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('createCustomer échoue au lieu de renvoyer un client fictif', async () => {
    const { createCustomer } = chargerService();
    await expect(createCustomer({ email: 'a@b.fr', nom: 'X', companyName: 'Y' }))
      .rejects.toThrow(/facturation non configurée/i);
  });

  it('createCheckoutSession échoue au lieu de renvoyer une session vide', async () => {
    const { createCheckoutSession } = chargerService();
    await expect(createCheckoutSession({ plan: { id: 'business', nom: 'Business', prix: 89 }, companyId: 'c1', appUrl: 'https://x.fr' }))
      .rejects.toThrow(/facturation non configurée/i);
  });

  it('l\'erreur porte un statut 503, pour ne pas être confondue avec un bug applicatif', async () => {
    const { createCustomer, StripeIndisponibleError } = chargerService();
    await createCustomer({ email: 'a@b.fr' }).catch((err) => {
      expect(err).toBeInstanceOf(StripeIndisponibleError);
      expect(err.status).toBe(503);
    });
    expect.assertions(2);
  });
});

describe('Stripe non configuré — hors production', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('tolère le mode démo pour le développement local', async () => {
    const { createCustomer } = chargerService();
    const client = await createCustomer({ email: 'a@b.fr', nom: 'X', companyName: 'Y' });
    expect(client.mock).toBe(true);
  });

  it('même en mode démo, aucune session de paiement exploitable n\'est produite', async () => {
    const { createCheckoutSession } = chargerService();
    const session = await createCheckoutSession({ plan: { id: 'business', prix: 89 }, companyId: 'c1', appUrl: 'https://x.fr' });
    expect(session.url).toBeNull();
  });
});
