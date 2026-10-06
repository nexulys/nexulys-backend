/**
 * La sonde de vie doit rester lisible depuis n'importe quelle origine.
 *
 * C'est ce qui permet à /diagnostic.html de distinguer deux pannes que le navigateur
 * signale de façon identique : « service arrêté » et « origine non autorisée par le
 * CORS ». Si quelqu'un soumet un jour /api/health/live à l'allowlist, le diagnostic
 * recommencerait à accuser le serveur d'être arrêté alors qu'il tourne — ce test
 * l'interdit.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_ci_only';
process.env.ALLOWED_ORIGINS = 'https://origine-autorisee.example';

const request = require('supertest');

let app;
beforeAll(() => {
  jest.resetModules();
  app = require('../../server');
});

const ORIGINE_INCONNUE = 'https://site-inconnu.example';

describe('sonde de vie /api/health/live', () => {
  test('est lisible par une origine absente de l\'allowlist', async () => {
    const res = await request(app).get('/api/health/live').set('Origin', ORIGINE_INCONNUE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ alive: true });
    expect(res.headers['access-control-allow-origin']).toBe('*');
    // Sans cet en-tête, Cross-Origin-Resource-Policy d'helmet bloquerait la lecture.
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  test('conserve l\'origine explicite quand elle est autorisée, et non « * »', async () => {
    const res = await request(app)
      .get('/api/health/live')
      .set('Origin', 'https://origine-autorisee.example');
    expect(res.status).toBe(200);
    // « * » combiné à Access-Control-Allow-Credentials invaliderait toute requête
    // porteuse d'identifiants : l'en-tête générique ne doit pas écraser l'origine.
    expect(res.headers['access-control-allow-origin']).toBe('https://origine-autorisee.example');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('l\'état de santé complet reste soumis à l\'allowlist', async () => {
    const res = await request(app).get('/api/health').set('Origin', ORIGINE_INCONNUE);
    // La réponse part côté serveur, mais sans en-tête d'autorisation le navigateur la
    // rejette : c'est précisément ce contraste avec /live qui identifie la panne.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
