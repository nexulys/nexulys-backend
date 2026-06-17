const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/novexa_test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/health', () => {
  it('retourne le statut de l\'API', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.platform).toBe('Novexa by Nexulys');
  });
});

describe('GET /api/abonnement/plans', () => {
  it('retourne les plans disponibles avec le prix 2500€', async () => {
    const res = await request(app).get('/api/abonnement/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans[0].prix).toBe(2500);
  });
});
