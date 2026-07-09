const request = require('supertest');
const db = require('../helpers/db');
const app = require('../../server');

jest.setTimeout(60000);

beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.close(); });

const validUser = {
  nom: 'Test', prenom: 'User', email: 'test@test.fr',
  password: 'password123', nomEntreprise: 'TestCo'
};

describe('POST /api/auth/register', () => {
  it('crée un compte avec des données valides', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('pose un cookie httpOnly à la création', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...validUser, email: 'cookie@test.fr', nomEntreprise: 'CookieCo' });
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => /novexa_token/.test(c) && /HttpOnly/i.test(c))).toBe(true);
  });

  it('rejette un email invalide', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejette un mot de passe trop court (< 8)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...validUser, email: 'short@test.fr', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejette un email déjà utilisé', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register')
      .send({ ...validUser, nomEntreprise: 'Autre' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('connecte avec des identifiants valides', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('refuse des identifiants invalides', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it("résiste à une injection NoSQL dans le mot de passe", async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: validUser.email, password: { $ne: '' } });
    expect(res.status).not.toBe(200); // l'opérateur $ne est stripé -> pas de bypass
  });
});

describe('GET /api/auth/me', () => {
  let token;
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    token = res.body.data.token;
  });

  it('retourne le profil avec un token Bearer valide', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(validUser.email);
  });

  it('refuse sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('refuse avec un token invalide', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer faux.token.invalide');
    expect(res.status).toBe(401);
  });
});
