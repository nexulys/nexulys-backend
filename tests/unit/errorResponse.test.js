const { sendError } = require('../../utils/errorResponse');

// Mock minimal de l'objet res Express
const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

describe('sendError (réponses d’erreur centralisées)', () => {
  it('mappe une ValidationError Mongoose sur 400 + détail des champs', () => {
    const res = mockRes();
    const err = {
      name: 'ValidationError',
      errors: { nom: { path: 'nom', message: 'Le nom est requis' } }
    };
    sendError(res, err);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual([{ champ: 'nom', message: 'Le nom est requis' }]);
  });

  it('mappe une CastError (ObjectId invalide) sur 400', () => {
    const res = mockRes();
    sendError(res, { name: 'CastError', value: 'abc' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Identifiant invalide/);
  });

  it('mappe un doublon d’index unique (11000) sur 409', () => {
    const res = mockRes();
    sendError(res, { code: 11000, keyPattern: { email: 1 } });
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/email/);
  });

  it('mappe une erreur inconnue sur 500', () => {
    const res = mockRes();
    sendError(res, new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('masque le message interne en production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    sendError(res, new Error('secret interne'));
    expect(res.body.message).toBe('Erreur interne.');
    process.env.NODE_ENV = prev;
  });
});
