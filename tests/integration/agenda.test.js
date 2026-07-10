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

describe('Agenda (CRUD, échéances fiscales, isolation, IDOR)', () => {
  let tokenA, tokenB, eventIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('ag-a@corp.fr', 'AG A');
    tokenB = await registerCompany('ag-b@corp.fr', 'AG B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/agenda')).status).toBe(401);
  });

  it('crée un événement', async () => {
    const res = await request(app).post('/api/agenda')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ titre: 'Rendez-vous client', dateDebut: '2025-09-01T10:00:00Z' });
    expect(res.status).toBe(201);
    eventIdA = res.body.data._id;
    expect(eventIdA).toBeDefined();
  });

  it('retourne les échéances fiscales', async () => {
    const res = await request(app).get('/api/agenda/echeances-fiscales')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("l'entreprise B ne voit pas les événements de A", async () => {
    const res = await request(app).get('/api/agenda').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(e => String(e._id))).not.toContain(String(eventIdA));
  });

  it("l'entreprise B ne peut pas modifier l'événement de A (IDOR)", async () => {
    const res = await request(app).put(`/api/agenda/${eventIdA}`)
      .set('Authorization', `Bearer ${tokenB}`).send({ titre: 'Piraté' });
    expect(res.status).toBe(404);
  });
});
