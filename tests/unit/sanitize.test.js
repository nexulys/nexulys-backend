const { sanitizeMongo, sanitizeMiddleware } = require('../../utils/sanitize');

describe('sanitizeMongo (anti-injection NoSQL)', () => {
  it("supprime les clés d'opérateur MongoDB ($)", () => {
    const input = { email: 'a@b.fr', password: { $ne: '' } };
    sanitizeMongo(input);
    expect(input.email).toBe('a@b.fr');
    expect(input.password).toEqual({}); // $ne supprimé
  });

  it('supprime les clés contenant un point', () => {
    const input = { 'a.b': 1, normal: 2 };
    sanitizeMongo(input);
    expect(input['a.b']).toBeUndefined();
    expect(input.normal).toBe(2);
  });

  it('nettoie récursivement les objets imbriqués', () => {
    const input = { user: { name: 'x', filter: { $gt: 0 } } };
    sanitizeMongo(input);
    expect(input.user.name).toBe('x');
    expect(input.user.filter).toEqual({});
  });

  it('nettoie les objets dans des tableaux', () => {
    const input = { items: [{ $where: 'malicious' }, { ok: 1 }] };
    sanitizeMongo(input);
    expect(input.items[0]).toEqual({});
    expect(input.items[1]).toEqual({ ok: 1 });
  });

  it('préserve les valeurs légitimes', () => {
    const input = { a: 1, b: 'texte', c: true, d: null };
    const before = JSON.stringify(input);
    sanitizeMongo(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('ne plante pas sur null / undefined / primitifs', () => {
    expect(() => sanitizeMongo(null)).not.toThrow();
    expect(() => sanitizeMongo(undefined)).not.toThrow();
    expect(() => sanitizeMongo('x')).not.toThrow();
    expect(() => sanitizeMongo(42)).not.toThrow();
  });
});

describe('sanitizeMiddleware', () => {
  it('assainit req.body et req.query puis appelle next()', () => {
    const req = { body: { name: 'x', bad: { $ne: 1 } }, query: { 'a.b': 1 } };
    const next = jest.fn();
    sanitizeMiddleware(req, {}, next);
    expect(req.body.bad).toEqual({});
    expect(req.query['a.b']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
