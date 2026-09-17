/**
 * Non-régression : les quotas ne doivent pas faire échouer la suite de tests.
 *
 * Les tests d'intégration s'exécutent en un seul processus (--runInBand) et partagent
 * le compteur en mémoire. Avec 33 appels à /api/auth/* contre une limite de 10, tout
 * ce qui suivait recevait un 429 — ce qui faisait échouer l'étape « Integration tests »
 * de la CI, sans rapport avec le code testé.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_ci_only';

const request = require('supertest');

const chargerApp = () => {
  jest.resetModules();
  return require('../../server');
};

// /api/auth/logout passe par le même authLimiter que /login mais ne touche pas la
// base : le test mesure le quota sans dépendre d'une connexion MongoDB.
const rafale = async (app, n) => {
  const codes = [];
  for (let i = 0; i < n; i++) {
    const r = await request(app).post('/api/auth/logout').send({});
    codes.push(r.status);
  }
  return codes;
};

describe('Quotas de requêtes en environnement de test', () => {
  const ENV_INITIAL = process.env.TEST_RATE_LIMIT;
  afterEach(() => {
    if (ENV_INITIAL === undefined) delete process.env.TEST_RATE_LIMIT;
    else process.env.TEST_RATE_LIMIT = ENV_INITIAL;
  });

  it('laisse passer 33 appels consécutifs sur /api/auth/* (volume réel de la suite)', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_RATE_LIMIT;
    const codes = await rafale(chargerApp(), 33);
    expect(codes.filter((c) => c === 429)).toHaveLength(0);
  }, 60000);

  it('reste activable par TEST_RATE_LIMIT, pour pouvoir vérifier la limitation', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_RATE_LIMIT = 'true';
    const codes = await rafale(chargerApp(), 14);
    // Au-delà de 10 tentatives sur 15 minutes, l'anti-brute-force doit répondre 429.
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  }, 60000);
});
