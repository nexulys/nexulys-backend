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

describe('Projets (CRUD, isolation, validation)', () => {
  let tokenA, tokenB, projetIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('proj-a@corp.fr', 'Proj A');
    tokenB = await registerCompany('proj-b@corp.fr', 'Proj B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/projets')).status).toBe(401);
  });

  it('crée un projet', async () => {
    const res = await request(app).post('/api/projets')
      .set('Authorization', `Bearer ${tokenA}`).send({ nom: 'Refonte site', budget: 15000 });
    expect(res.status).toBe(201);
    projetIdA = res.body.data._id;
    expect(projetIdA).toBeDefined();
  });

  it('rejette un projet sans nom', async () => {
    const res = await request(app).post('/api/projets')
      .set('Authorization', `Bearer ${tokenA}`).send({ budget: 1000 });
    expect(res.status).toBe(400);
  });

  it("l'entreprise B ne voit pas les projets de A", async () => {
    const res = await request(app).get('/api/projets').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(p => String(p._id))).not.toContain(String(projetIdA));
  });

  it("l'entreprise B ne peut pas modifier le projet de A (IDOR)", async () => {
    const res = await request(app).put(`/api/projets/${projetIdA}`)
      .set('Authorization', `Bearer ${tokenB}`).send({ nom: 'Piraté' });
    expect(res.status).toBe(404);
  });
});
