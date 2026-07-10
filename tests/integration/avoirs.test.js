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

const avoirPayload = {
  client: { nom: 'Client X' },
  motif: 'Retour marchandise',
  lignes: [{ description: 'Article défectueux', quantite: 1, prixUnitaire: 100, montantHT: 100, tva: 20 }]
};

describe('Avoirs (CRUD, isolation, IDOR)', () => {
  let tokenA, tokenB, avoirIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('av-a@corp.fr', 'AV A');
    tokenB = await registerCompany('av-b@corp.fr', 'AV B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/avoirs')).status).toBe(401);
  });

  it('crée un avoir avec numéro auto et montants calculés', async () => {
    const res = await request(app).post('/api/avoirs')
      .set('Authorization', `Bearer ${tokenA}`).send(avoirPayload);
    expect(res.status).toBe(201);
    avoirIdA = res.body.data._id;
    expect(res.body.data.numero).toMatch(/^AV-\d{4}-\d{4}$/);
    expect(res.body.data.montantTTC).toBeCloseTo(120, 1);
  });

  it("l'entreprise B ne voit pas les avoirs de A", async () => {
    const res = await request(app).get('/api/avoirs').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(a => String(a._id))).not.toContain(String(avoirIdA));
  });

  it("l'entreprise B ne peut pas modifier l'avoir de A (IDOR)", async () => {
    const res = await request(app).put(`/api/avoirs/${avoirIdA}`)
      .set('Authorization', `Bearer ${tokenB}`).send({ motif: 'Piraté' });
    expect(res.status).toBe(404);
  });
});
