const request = require('supertest');
const db = require('../helpers/db');
const app = require('../../server');

jest.setTimeout(60000);
beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.close(); });

describe('RBAC — restriction des données sensibles par rôle', () => {
  let adminToken, employeeToken;

  beforeAll(async () => {
    // Le créateur du compte est admin
    const reg = await request(app).post('/api/auth/register').send({
      nom: 'Boss', prenom: 'A', email: 'boss@rbac.fr', password: 'password123', nomEntreprise: 'RBAC Co'
    });
    adminToken = reg.body.data.token;

    // L'admin invite un employé standard
    await request(app).post('/api/equipe').set('Authorization', `Bearer ${adminToken}`).send({
      prenom: 'Emp', nom: 'Loye', email: 'emp@rbac.fr', role: 'employee', motDePasse: 'password123'
    });
    const login = await request(app).post('/api/auth/login').send({ email: 'emp@rbac.fr', password: 'password123' });
    employeeToken = login.body.data.token;
  });

  it("l'admin peut générer une fiche de paie", async () => {
    const emp = await request(app).post('/api/rh/employes').set('Authorization', `Bearer ${adminToken}`).send({
      nom: 'X', prenom: 'Y', email: 'x@y.fr', poste: 'Dev', salaireBase: 2500, dateEmbauche: '2022-01-01'
    });
    const res = await request(app).post('/api/rh/paie/generer').set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: emp.body.data._id, mois: 6, annee: 2025 });
    expect(res.status).toBe(201);
  });

  it("l'employé standard est bloqué sur la génération de paie (403)", async () => {
    expect(employeeToken).toBeDefined();
    const res = await request(app).post('/api/rh/paie/generer').set('Authorization', `Bearer ${employeeToken}`)
      .send({ employeeId: '000000000000000000000000', mois: 6, annee: 2025 });
    expect(res.status).toBe(403);
  });

  it("l'employé standard est bloqué sur les réglages entreprise (403)", async () => {
    const res = await request(app).put('/api/comptabilite/settings').set('Authorization', `Bearer ${employeeToken}`)
      .send({ nom: 'Hack' });
    expect(res.status).toBe(403);
  });

  it("l'employé standard n'est PAS bloqué pour demander un congé (pas de 403)", async () => {
    const res = await request(app).post('/api/rh/conges').set('Authorization', `Bearer ${employeeToken}`)
      .send({ type: 'paye', dateDebut: '2025-08-01', dateFin: '2025-08-05' });
    expect(res.status).not.toBe(403);
  });
});
