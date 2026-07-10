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

describe('Centres analytiques (CRUD, isolation, IDOR)', () => {
  let tokenA, tokenB, centreIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('ca-a@corp.fr', 'CA A');
    tokenB = await registerCompany('ca-b@corp.fr', 'CA B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/centres-analytiques')).status).toBe(401);
  });

  it('crée un centre analytique', async () => {
    const res = await request(app).post('/api/centres-analytiques')
      .set('Authorization', `Bearer ${tokenA}`).send({ nom: 'Département R&D', code: 'RD' });
    expect(res.status).toBe(201);
    centreIdA = res.body.data._id;
    expect(centreIdA).toBeDefined();
  });

  it("l'entreprise B ne voit pas les centres de A", async () => {
    const res = await request(app).get('/api/centres-analytiques').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(c => String(c._id))).not.toContain(String(centreIdA));
  });

  it("l'entreprise B ne peut pas modifier le centre de A (IDOR)", async () => {
    const res = await request(app).put(`/api/centres-analytiques/${centreIdA}`)
      .set('Authorization', `Bearer ${tokenB}`).send({ nom: 'Piraté' });
    expect(res.status).toBe(404);
  });
});
