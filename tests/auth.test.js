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

describe('POST /api/auth/register', () => {
  it('crée un compte avec données valides', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nom: 'Test', prenom: 'User', email: 'test@test.fr',
      password: 'password123', nomEntreprise: 'TestCo'
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('rejette un email invalide', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nom: 'Test', prenom: 'User', email: 'not-an-email',
      password: 'password123', nomEntreprise: 'TestCo'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejette un mot de passe trop court', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nom: 'Test', prenom: 'User', email: 'test2@test.fr',
      password: '123', nomEntreprise: 'TestCo'
    });
    expect(res.status).toBe(400);
  });

  it('rejette un email déjà utilisé', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nom: 'Test', prenom: 'User', email: 'test@test.fr',
      password: 'password123', nomEntreprise: 'TestCo2'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/déjà utilisé/);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte avec identifiants valides', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.fr', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('refuse des identifiants invalides', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.fr', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.fr', password: 'password123' });
    token = res.body.data.token;
  });

  it('retourne le profil avec token valide', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@test.fr');
  });

  it('refuse sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
