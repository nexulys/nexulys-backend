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

describe('Notes de frais (CRUD, validation, workflow, isolation)', () => {
  let tokenA, tokenB, noteIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('nf-a@corp.fr', 'NF A');
    tokenB = await registerCompany('nf-b@corp.fr', 'NF B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/notes-frais')).status).toBe(401);
  });

  it('crée une note de frais', async () => {
    const res = await request(app).post('/api/notes-frais')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ titre: 'Repas client', montant: 45.5, categorie: 'restauration', date: '2025-06-01' });
    expect(res.status).toBe(201);
    noteIdA = res.body.data._id;
    expect(noteIdA).toBeDefined();
  });

  it('rejette une note sans titre ni montant', async () => {
    const res = await request(app).post('/api/notes-frais')
      .set('Authorization', `Bearer ${tokenA}`).send({ categorie: 'transport' });
    expect(res.status).toBe(400);
  });

  it('approuve la note (workflow)', async () => {
    const res = await request(app).post(`/api/notes-frais/${noteIdA}/approuver`)
      .set('Authorization', `Bearer ${tokenA}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('approuvee');
  });

  it("l'entreprise B ne voit pas les notes de A", async () => {
    const res = await request(app).get('/api/notes-frais').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(n => String(n._id))).not.toContain(String(noteIdA));
  });

  it("l'entreprise B ne peut pas rejeter la note de A (IDOR)", async () => {
    const res = await request(app).post(`/api/notes-frais/${noteIdA}/rejeter`)
      .set('Authorization', `Bearer ${tokenB}`).send({ commentaire: 'x' });
    expect(res.status).toBe(404);
  });
});
