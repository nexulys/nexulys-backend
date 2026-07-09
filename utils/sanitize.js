/**
 * Sanitisation anti-injection NoSQL.
 * Supprime récursivement toute clé commençant par '$' (opérateurs MongoDB)
 * ou contenant un '.' (accès à des sous-champs), sur les objets et tableaux.
 * Protège req.body / req.query contre les payloads du type { "$gt": "" } ou { "a.b": 1 }.
 */
const sanitizeMongo = (obj) => {
  if (Array.isArray(obj)) {
    obj.forEach(sanitizeMongo);
    return obj;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        sanitizeMongo(obj[key]);
      }
    }
  }
  return obj;
};

/** Middleware Express appliquant la sanitisation à body et query. */
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) sanitizeMongo(req.body);
  if (req.query) sanitizeMongo(req.query);
  next();
};

module.exports = { sanitizeMongo, sanitizeMiddleware };
