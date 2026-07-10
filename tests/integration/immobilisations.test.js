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

const immoPayload = {
  nom: 'Ordinateur portable', categorie: 'materiel',
  dateAcquisition: '2024-01-10', valeurAcquisition: 1200, dureeAmortissement: 3
};

describe('Immobilisations (CRUD, amortissement, isolation, IDOR)', () => {
  let tokenA, tokenB, immoIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('immo-a@corp.fr', 'IMMO A');
    tokenB = await registerCompany('immo-b@corp.fr', 'IMMO B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/immobilisations')).status).toBe(401);
  });

  it("crée une immobilisation et calcule l'amortissement", async () => {
    const res = await request(app).post('/api/immobilisations')
      .set('Authorization', `Bearer ${tokenA}`).send(immoPayload);
    expect(res.status).toBe(201);
    immoIdA = res.body.data._id;
    expect(immoIdA).toBeDefined();
  });

  it('expose le tableau d’amortissement', async () => {
    const res = await request(app).get(`/api/immobilisations/${immoIdA}/amortissements`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("l'entreprise B ne voit pas les immobilisations de A", async () => {
    const res = await request(app).get('/api/immobilisations').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(i => String(i._id))).not.toContain(String(immoIdA));
  });

  it("l'entreprise B ne peut pas modifier l'immobilisation de A (IDOR)", async () => {
    const res = await request(app).put(`/api/immobilisations/${immoIdA}`)
      .set('Authorization', `Bearer ${tokenB}`).send({ nom: 'Piraté' });
    expect(res.status).toBe(404);
  });
});
