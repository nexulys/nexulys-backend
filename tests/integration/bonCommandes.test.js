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

const bonPayload = {
  fournisseur: { nom: 'Fournisseur Y' },
  lignes: [{ description: 'Matières premières', quantite: 10, prixUnitaire: 50, montantHT: 500, tva: 20 }]
};

describe('Bons de commande (CRUD, réception, isolation, IDOR)', () => {
  let tokenA, tokenB, bonIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('bc-a@corp.fr', 'BC A');
    tokenB = await registerCompany('bc-b@corp.fr', 'BC B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/bon-commandes')).status).toBe(401);
  });

  it('crée un bon de commande avec numéro auto', async () => {
    const res = await request(app).post('/api/bon-commandes')
      .set('Authorization', `Bearer ${tokenA}`).send(bonPayload);
    expect(res.status).toBe(201);
    bonIdA = res.body.data._id;
    expect(res.body.data.numero).toMatch(/^BC-\d{4}-\d{4}$/);
  });

  it('marque la commande comme reçue', async () => {
    const res = await request(app).put(`/api/bon-commandes/${bonIdA}/recevoir`)
      .set('Authorization', `Bearer ${tokenA}`).send({});
    expect(res.status).toBe(200);
  });

  it("l'entreprise B ne voit pas les bons de A", async () => {
    const res = await request(app).get('/api/bon-commandes').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(b => String(b._id))).not.toContain(String(bonIdA));
  });

  it("l'entreprise B ne peut pas recevoir le bon de A (IDOR)", async () => {
    const res = await request(app).put(`/api/bon-commandes/${bonIdA}/recevoir`)
      .set('Authorization', `Bearer ${tokenB}`).send({});
    expect(res.status).toBe(404);
  });
});
