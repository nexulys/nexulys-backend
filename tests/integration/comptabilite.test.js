const request = require('supertest');
const db = require('../helpers/db');
const app = require('../../server');

jest.setTimeout(60000);

beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.close(); });

// Inscrit une entreprise et renvoie son token Bearer
const registerCompany = async (email, nomEntreprise) => {
  const res = await request(app).post('/api/auth/register').send({
    nom: 'N', prenom: 'P', email, password: 'password123', nomEntreprise
  });
  return res.body.data.token;
};

const invoicePayload = {
  client: { nom: 'Client SARL', email: 'client@x.fr' },
  lignes: [{ description: 'Prestation', quantite: 2, prixUnitaire: 500, montantHT: 1000 }],
  montantHT: 1000, tauxTVA: 20
};

describe('Factures — CRUD et isolation multi-tenant', () => {
  let tokenA, tokenB, invoiceIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('a@corp.fr', 'Corp A');
    tokenB = await registerCompany('b@corp.fr', 'Corp B');
  });

  it("refuse l'accès sans authentification", async () => {
    const res = await request(app).get('/api/comptabilite/factures');
    expect(res.status).toBe(401);
  });

  it('crée une facture pour l’entreprise A', async () => {
    const res = await request(app).post('/api/comptabilite/factures')
      .set('Authorization', `Bearer ${tokenA}`).send(invoicePayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    invoiceIdA = res.body.data._id;
    expect(invoiceIdA).toBeDefined();
  });

  it('valide les entrées (rejette une facture sans ligne)', async () => {
    const res = await request(app).post('/api/comptabilite/factures')
      .set('Authorization', `Bearer ${tokenA}`).send({ client: { nom: 'X' }, lignes: [] });
    expect(res.status).toBe(400);
  });

  it('l’entreprise A voit sa facture dans sa liste', async () => {
    const res = await request(app).get('/api/comptabilite/factures')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const list = res.body.data.factures || res.body.data;
    expect(Array.isArray(list) ? list.length : 0).toBeGreaterThan(0);
  });

  it('l’entreprise B NE voit PAS la facture de A (cloisonnement)', async () => {
    const res = await request(app).get('/api/comptabilite/factures')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const list = res.body.data.factures || res.body.data || [];
    const ids = (Array.isArray(list) ? list : []).map(f => String(f._id));
    expect(ids).not.toContain(String(invoiceIdA));
  });

  it('l’entreprise B ne peut pas récupérer la facture de A par son id (IDOR bloqué)', async () => {
    const res = await request(app).get(`/api/comptabilite/factures/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('l’entreprise B ne peut pas supprimer la facture de A', async () => {
    await request(app).delete(`/api/comptabilite/factures/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    // la facture de A doit toujours exister
    const res = await request(app).get(`/api/comptabilite/factures/${invoiceIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
  });
});
