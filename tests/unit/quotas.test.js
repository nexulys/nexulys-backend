jest.mock('../../models/Subscription', () => ({
  findOne: jest.fn(() => ({ select: () => Promise.resolve(global.__SUB__) })),
}));
jest.mock('../../models/User', () => ({
  countDocuments: jest.fn(() => Promise.resolve(global.__NB_USERS__ ?? 0)),
}));
jest.mock('../../models/Employee', () => ({
  countDocuments: jest.fn(() => Promise.resolve(global.__NB_EMPLOYES__ ?? 0)),
}));

const { verifierQuota } = require('../../utils/quotas');

const COMPANY = '507f1f77bcf86cd799439099';

beforeEach(() => {
  global.__SUB__ = { plan: 'business' };
  global.__NB_USERS__ = 0;
  global.__NB_EMPLOYES__ = 0;
});

describe('verifierQuota — limites de plan', () => {
  describe('Starter (1 utilisateur, 0 employé)', () => {
    beforeEach(() => { global.__SUB__ = { plan: 'starter' }; });

    it('autorise le premier utilisateur', async () => {
      global.__NB_USERS__ = 0;
      expect(await verifierQuota(COMPANY, 'utilisateurs')).toBeNull();
    });

    it('refuse le deuxième utilisateur', async () => {
      global.__NB_USERS__ = 1;
      const r = await verifierQuota(COMPANY, 'utilisateurs');
      expect(r).not.toBeNull();
      expect(r.max).toBe(1);
      expect(r.message).toMatch(/limite atteinte/i);
    });

    it('refuse tout employé, et l\'explique par le plan', async () => {
      const r = await verifierQuota(COMPANY, 'employes');
      expect(r).not.toBeNull();
      expect(r.max).toBe(0);
      expect(r.message).toMatch(/n'inclut pas/i);
    });
  });

  describe('Business (10 utilisateurs, 25 employés)', () => {
    it('autorise en deçà de la limite', async () => {
      global.__NB_USERS__ = 9;
      global.__NB_EMPLOYES__ = 24;
      expect(await verifierQuota(COMPANY, 'utilisateurs')).toBeNull();
      expect(await verifierQuota(COMPANY, 'employes')).toBeNull();
    });

    it('refuse une fois la limite atteinte', async () => {
      global.__NB_USERS__ = 10;
      global.__NB_EMPLOYES__ = 25;
      expect(await verifierQuota(COMPANY, 'utilisateurs')).not.toBeNull();
      expect(await verifierQuota(COMPANY, 'employes')).not.toBeNull();
    });
  });

  describe('Pro (illimité)', () => {
    beforeEach(() => { global.__SUB__ = { plan: 'pro' }; });

    it('n\'applique aucune limite', async () => {
      global.__NB_USERS__ = 5000;
      global.__NB_EMPLOYES__ = 5000;
      expect(await verifierQuota(COMPANY, 'utilisateurs')).toBeNull();
      expect(await verifierQuota(COMPANY, 'employes')).toBeNull();
    });
  });

  it('retombe sur le plan par défaut quand aucun abonnement n\'existe', async () => {
    global.__SUB__ = null;
    global.__NB_USERS__ = 10; // limite Business
    expect(await verifierQuota(COMPANY, 'utilisateurs')).not.toBeNull();
  });

  it('ignore une ressource inconnue plutôt que de bloquer', async () => {
    expect(await verifierQuota(COMPANY, 'licornes')).toBeNull();
  });

  it('ne bloque pas si l\'entreprise n\'est pas renseignée', async () => {
    expect(await verifierQuota(null, 'utilisateurs')).toBeNull();
  });
});
