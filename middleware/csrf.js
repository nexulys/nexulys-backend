/**
 * Protection CSRF par vérification d'origine.
 *
 * Le cookie de session est posé en `sameSite: 'none'` en production (front sur un
 * domaine distinct) : le navigateur l'envoie donc sur les requêtes déclenchées par
 * n'importe quel site tiers. Comme `express.urlencoded` est activé, un simple
 * <form method="POST"> hébergé par un attaquant part sans preflight CORS et exécute
 * une action authentifiée au nom de la victime.
 *
 * On n'applique le contrôle qu'aux requêtes mutantes réellement authentifiées par
 * cookie : un appel porteur d'un Bearer token (client mobile, API) n'est pas
 * exposé au CSRF puisque le navigateur n'attache pas l'en-tête automatiquement.
 */
const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfGuard = (allowedOrigins) => (req, res, next) => {
  if (METHODES_SURES.has(req.method)) return next();

  const authParCookie = Boolean(req.cookies?.novexa_token);
  const authParBearer = req.headers.authorization?.startsWith('Bearer ');
  if (!authParCookie || authParBearer) return next();

  const origin = req.headers.origin;
  if (origin) {
    if (allowedOrigins.includes(origin)) return next();
    return res.status(403).json({ success: false, message: 'Origine non autorisée.' });
  }

  // Pas d'Origin : on retombe sur le Referer, que les navigateurs envoient sur les
  // soumissions de formulaire cross-site.
  const referer = req.headers.referer;
  if (referer) {
    try {
      if (allowedOrigins.includes(new URL(referer).origin)) return next();
    } catch { /* Referer illisible : traité comme absent */ }
    return res.status(403).json({ success: false, message: 'Origine non autorisée.' });
  }

  // Ni Origin ni Referer sur une requête à cookie : ce n'est pas un navigateur
  // dans un contexte cross-site normal, on refuse.
  return res.status(403).json({ success: false, message: 'Origine manquante.' });
};

module.exports = { csrfGuard };
