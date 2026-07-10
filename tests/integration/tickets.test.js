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

describe('Tickets support (CRUD, statut, isolation)', () => {
  let tokenA, tokenB, ticketIdA;

  beforeAll(async () => {
    tokenA = await registerCompany('tk-a@corp.fr', 'TK A');
    tokenB = await registerCompany('tk-b@corp.fr', 'TK B');
  });

  it("refuse l'accès sans authentification", async () => {
    expect((await request(app).get('/api/tickets')).status).toBe(401);
  });

  it('crée un ticket', async () => {
    const res = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ titre: 'Bug facture', description: 'Erreur au téléchargement', priorite: 'haute', categorie: 'technique' });
    expect(res.status).toBe(201);
    ticketIdA = res.body.data._id;
    expect(res.body.data.statut).toBe('ouvert');
  });

  it('met à jour le statut du ticket', async () => {
    const res = await request(app).put(`/api/tickets/${ticketIdA}/statut`)
      .set('Authorization', `Bearer ${tokenA}`).send({ statut: 'en_cours' });
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('en_cours');
  });

  it("l'entreprise B ne voit pas les tickets de A", async () => {
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map(t => String(t._id))).not.toContain(String(ticketIdA));
  });

  it("l'entreprise B ne peut pas changer le statut du ticket de A (IDOR)", async () => {
    const res = await request(app).put(`/api/tickets/${ticketIdA}/statut`)
      .set('Authorization', `Bearer ${tokenB}`).send({ statut: 'ferme' });
    expect(res.status).toBe(404);
  });
});
