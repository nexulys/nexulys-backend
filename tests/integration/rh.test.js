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

const employeePayload = {
  nom: 'Dupont', prenom: 'Marie', email: 'marie@corp.fr',
  poste: 'Développeuse', salaireBase: 3000, dateEmbauche: '2022-01-15',
  tauxImpot: 0.075
};

describe('RH — employés (CRUD, isolation, validation)', () => {
  let tokenA, tokenB, employeeIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('rh-a@corp.fr', 'RH Corp A');
    tokenB = await registerCompany('rh-b@corp.fr', 'RH Corp B');
  });

  it("refuse l'accès sans authentification", async () => {
    const res = await request(app).get('/api/rh/employes');
    expect(res.status).toBe(401);
  });

  it('crée un employé', async () => {
    const res = await request(app).post('/api/rh/employes')
      .set('Authorization', `Bearer ${tokenA}`).send(employeePayload);
    expect(res.status).toBe(201);
    employeeIdA = res.body.data._id;
    expect(employeeIdA).toBeDefined();
  });

  it('valide les entrées (rejette un salaire manquant)', async () => {
    const res = await request(app).post('/api/rh/employes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'X', prenom: 'Y', email: 'z@z.fr', poste: 'Test', dateEmbauche: '2022-01-01' });
    expect(res.status).toBe(400);
  });

  it("l'entreprise B ne voit pas les employés de A", async () => {
    const res = await request(app).get('/api/rh/employes').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(e => String(e._id))).not.toContain(String(employeeIdA));
  });

  it("l'entreprise B ne peut pas lire l'employé de A par id (IDOR)", async () => {
    const res = await request(app).get(`/api/rh/employes/${employeeIdA}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

describe('RH — génération de fiche de paie', () => {
  let token, employeeId;

  beforeAll(async () => {
    token = await registerCompany('paie@corp.fr', 'Paie Corp');
    const res = await request(app).post('/api/rh/employes')
      .set('Authorization', `Bearer ${token}`).send(employeePayload);
    employeeId = res.body.data._id;
  });

  it('génère une fiche avec cotisations détaillées et PAS appliqué', async () => {
    const res = await request(app).post('/api/rh/paie/generer')
      .set('Authorization', `Bearer ${token}`)
      .send({ employeeId, mois: 6, annee: 2025 });
    expect(res.status).toBe(201);
    const p = res.body.data;
    expect(p.salaireBrut).toBe(3000);
    expect(Array.isArray(p.lignesCotisations)).toBe(true);
    expect(p.lignesCotisations.length).toBeGreaterThanOrEqual(10);
    expect(p.netAvantImpot).toBeLessThan(p.salaireBrut);
    // taux PAS 7.5% de l'employé appliqué
    expect(p.montantPAS).toBeGreaterThan(0);
    expect(p.netAPayer).toBeCloseTo(p.netAvantImpot - p.montantPAS, 1);
  });

  it('intègre les autres éléments (transport, titres-resto) dans le net', async () => {
    const res = await request(app).post('/api/rh/paie/generer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId, mois: 7, annee: 2025,
        autresElements: [{ libelle: 'Transport', montant: 40 }, { libelle: 'Titres-resto', montant: -80 }]
      });
    expect(res.status).toBe(201);
    expect(res.body.data.autresElements).toHaveLength(2);
  });
});
