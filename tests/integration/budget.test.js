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

describe('Budget (CRUD, isolation)', () => {
  let tokenA, tokenB, budgetIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('bud-a@corp.fr', 'Bud A');
    tokenB = await registerCompany('bud-b@corp.fr', 'Bud B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/budget?annee=2025')).status).toBe(401);
  });

  it('crée une ligne budgétaire', async () => {
    const res = await request(app).post('/api/budget')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ annee: 2025, categorie: 'Marketing', type: 'charge', montantPrevu: 12000 });
    expect(res.status).toBe(201);
    budgetIdA = res.body.data._id;
    expect(budgetIdA).toBeDefined();
  });

  it('liste les lignes de l’année pour l’entreprise', async () => {
    const res = await request(app).get('/api/budget?annee=2025').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(b => String(b._id))).toContain(String(budgetIdA));
  });

  it("l'entreprise B ne voit pas le budget de A", async () => {
    const res = await request(app).get('/api/budget?annee=2025').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(b => String(b._id))).not.toContain(String(budgetIdA));
  });

  it("la suppression par B n'affecte pas le budget de A", async () => {
    await request(app).delete(`/api/budget/${budgetIdA}`).set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app).get('/api/budget?annee=2025').set('Authorization', `Bearer ${tokenA}`);
    expect(res.body.data.map(b => String(b._id))).toContain(String(budgetIdA));
  });
});
