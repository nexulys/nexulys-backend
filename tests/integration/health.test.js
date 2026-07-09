const request = require('supertest');
const db = require('../helpers/db');
const app = require('../../server');

jest.setTimeout(60000);

beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.close(); });

describe('GET /api/health', () => {
  it("retourne le statut de l'API", async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.platform).toBe('Novexa by Nexulys');
  });
});

describe('GET /api/abonnement/plans', () => {
  it('retourne les plans disponibles', async () => {
    const res = await request(app).get('/api/abonnement/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.plans)).toBe(true);
  });
});

describe('Route inconnue', () => {
  it('renvoie 404 JSON', async () => {
    const res = await request(app).get('/api/route-inexistante');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
