/**
 * Extraction du jeton d'accès public (portail client, expert-comptable, signature).
 *
 * Ces jetons valent identité : placés dans l'URL, ils sont journalisés en clair par
 * nginx (access_log) et par morgan, et se retrouvent dans l'historique du navigateur.
 * L'en-tête X-Access-Token est donc la voie normale.
 *
 * Le paramètre d'URL reste accepté pour les liens déjà distribués aux clients, que
 * l'on ne peut pas révoquer ; le frontend bascule sur l'en-tête dès le premier appel.
 */
const resoudreToken = (req, res, next) => {
  const token = req.headers['x-access-token'] || req.params.token;
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{16,128}$/i.test(token)) {
    return res.status(401).json({ success: false, message: 'Jeton d\'accès manquant ou invalide.' });
  }
  req.accessToken = token;
  next();
};

module.exports = { resoudreToken };
