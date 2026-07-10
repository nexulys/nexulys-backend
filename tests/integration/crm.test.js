const request = require('supertest');
const db = require('../helpers/db');
const app = require('../../server');

jest.setTimeout(60000);

beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.close(); });

const registerCompany = async (email, nomEntreprise) => {
  const res = await request(app).post('/api/auth/register').send({
    nom: 'N', prenom: 'P', email, password: 'password123', nomEntreprise
  });
  return res.body.data.token;
};

describe('CRM — prospects (CRUD, isolation, validation)', () => {
  let tokenA, tokenB, prospectIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('crm-a@corp.fr', 'CRM Corp A');
    tokenB = await registerCompany('crm-b@corp.fr', 'CRM Corp B');
  });

  it("refuse l'accès sans authentification", async () => {
    const res = await request(app).get('/api/crm');
    expect(res.status).toBe(401);
  });

  it('crée un prospect', async () => {
    const res = await request(app).post('/api/crm')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'ACME', entreprise: 'ACME SAS', valeurEstimee: 5000, statut: 'prospect' });
    expect(res.status).toBe(201);
    prospectIdA = res.body.data._id;
    expect(prospectIdA).toBeDefined();
  });

  it('rejette un prospect sans nom', async () => {
    const res = await request(app).post('/api/crm')
      .set('Authorization', `Bearer ${tokenA}`).send({ entreprise: 'Sans nom' });
    expect(res.status).toBe(400);
  });

  it('retourne le pipeline avec la liste des prospects', async () => {
    const res = await request(app).get('/api/crm').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('met à jour le statut du prospect', async () => {
    const res = await request(app).put(`/api/crm/${prospectIdA}`)
      .set('Authorization', `Bearer ${tokenA}`).send({ statut: 'contact' });
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('contact');
  });

  it("l'entreprise B ne voit pas les prospects de A", async () => {
    const res = await request(app).get('/api/crm').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(p => String(p._id))).not.toContain(String(prospectIdA));
  });

  it("l'entreprise B ne peut pas modifier le prospect de A (IDOR)", async () => {
    const res = await request(app).put(`/api/crm/${prospectIdA}`)
      .set('Authorization', `Bearer ${tokenB}`).send({ statut: 'perdu' });
    expect(res.status).toBe(404);
  });
});
