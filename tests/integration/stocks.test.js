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

describe('Stocks — produits (CRUD, isolation, validation)', () => {
  let tokenA, tokenB, productIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('stock-a@corp.fr', 'Stock Corp A');
    tokenB = await registerCompany('stock-b@corp.fr', 'Stock Corp B');
  });

  it("refuse l'accès sans authentification", async () => {
    const res = await request(app).get('/api/stocks/produits');
    expect(res.status).toBe(401);
  });

  it('crée un produit', async () => {
    const res = await request(app).post('/api/stocks/produits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Clavier', sku: 'KB-001', quantite: 50, seuilAlerte: 10, prix: 29.9 });
    expect(res.status).toBe(201);
    productIdA = res.body.data._id;
    expect(productIdA).toBeDefined();
  });

  it('valide les entrées (rejette un produit sans SKU)', async () => {
    const res = await request(app).post('/api/stocks/produits')
      .set('Authorization', `Bearer ${tokenA}`).send({ nom: 'Sans SKU' });
    expect(res.status).toBe(400);
  });

  it('liste les produits de l’entreprise', async () => {
    const res = await request(app).get('/api/stocks/produits').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(p => String(p._id))).toContain(String(productIdA));
  });

  it("l'entreprise B ne voit pas les produits de A", async () => {
    const res = await request(app).get('/api/stocks/produits').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(p => String(p._id))).not.toContain(String(productIdA));
  });

  it("l'entreprise B ne peut pas lire le produit de A par id (IDOR)", async () => {
    const res = await request(app).get(`/api/stocks/produits/${productIdA}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("l'entreprise B ne peut pas supprimer le produit de A", async () => {
    await request(app).delete(`/api/stocks/produits/${productIdA}`).set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app).get(`/api/stocks/produits/${productIdA}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200); // toujours présent
  });
});
