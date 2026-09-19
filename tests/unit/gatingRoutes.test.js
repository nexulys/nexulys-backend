/**
 * Vérifie le câblage HTTP réel du gating d'abonnement : routes Express, ordre des
 * middlewares et codes de retour. Les modèles Mongoose sont mockés — l'environnement
 * de test ne peut pas obtenir de binaire MongoDB — mais la chaîne traversée
 * (protect → verifierAbonnement → contrôleur) est bien celle de production.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret_de_test';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

const COMPANY = '507f1f77bcf86cd799439099';
const USER = { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011', company: COMPANY, role: 'admin', actif: true, tokenVersion: 0 };

let abonnementCourant;

jest.mock('../../models/User', () => ({
  findById: jest.fn(() => Promise.resolve(global.__USER__)),
  findOne: jest.fn(() => Promise.resolve(null)),
  countDocuments: jest.fn(() => Promise.resolve(0)),
}));

jest.mock('../../models/Subscription', () => ({
  findOne: jest.fn(() => {
    const q = Promise.resolve(global.__SUB__);
    q.select = () => Promise.resolve(global.__SUB__);
    return q;
  }),
  exists: jest.fn(() => Promise.resolve(true)),
}));

const request = require('supertest');
const app = require('../../server');

const jeton = () => jwt.sign({ id: USER.id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (r) => r.set('Authorization', `Bearer ${jeton()}`);
const dans = (j) => new Date(Date.now() + j * 24 * 60 * 60 * 1000);

beforeEach(() => {
  global.__USER__ = { ...USER };
  global.__SUB__ = abonnementCourant;
});

describe('Gating d\'abonnement — écritures bloquées, lectures préservées', () => {
  describe('abonnement expiré', () => {
    beforeEach(() => { global.__SUB__ = { statut: 'essai', trialEndsAt: dans(-1), plan: 'business' }; });

    it('refuse la création d\'un employé en 402', async () => {
      const res = await auth(request(app).post('/api/rh/employes')).send({ nom: 'X', prenom: 'Y' });
      expect(res.status).toBe(402);
      expect(res.body.code).toBe('ABONNEMENT_INACTIF');
    });

    it('refuse la création d\'une facture en 402', async () => {
      const res = await auth(request(app).post('/api/comptabilite/factures')).send({});
      expect(res.status).toBe(402);
    });

    it('refuse la suppression', async () => {
      const res = await auth(request(app).delete('/api/rh/employes/507f1f77bcf86cd799439012'));
      expect(res.status).toBe(402);
    });

    it('laisse passer la lecture (pas de 402)', async () => {
      const res = await auth(request(app).get('/api/rh/employes'));
      expect(res.status).not.toBe(402);
    });

    it('laisse passer l\'export RGPD, même abonnement inactif', async () => {
      const res = await auth(request(app).get('/api/auth/rgpd/export'));
      expect(res.status).not.toBe(402);
    });

    it('ne bloque pas la souscription : on doit pouvoir régulariser', async () => {
      const res = await auth(request(app).post('/api/abonnement/activer')).send({ planId: 'business' });
      expect(res.status).not.toBe(402);
    });
  });

  describe('abonnement actif', () => {
    beforeEach(() => { global.__SUB__ = { statut: 'actif', plan: 'business' }; });

    it('laisse passer les écritures', async () => {
      const res = await auth(request(app).post('/api/rh/employes')).send({ nom: 'X', prenom: 'Y' });
      expect(res.status).not.toBe(402);
    });
  });

  describe('essai en cours', () => {
    beforeEach(() => { global.__SUB__ = { statut: 'essai', trialEndsAt: dans(7), plan: 'business' }; });

    it('laisse passer les écritures', async () => {
      const res = await auth(request(app).post('/api/rh/employes')).send({ nom: 'X', prenom: 'Y' });
      expect(res.status).not.toBe(402);
    });
  });

  describe('abonnement suspendu pour impayé', () => {
    beforeEach(() => { global.__SUB__ = { statut: 'suspendu', plan: 'business' }; });

    it('refuse les écritures', async () => {
      const res = await auth(request(app).post('/api/rh/employes')).send({ nom: 'X', prenom: 'Y' });
      expect(res.status).toBe(402);
    });
  });

  it('un utilisateur non authentifié reste en 401, pas en 402', async () => {
    const res = await request(app).post('/api/rh/employes').send({});
    expect(res.status).toBe(401);
  });
});
