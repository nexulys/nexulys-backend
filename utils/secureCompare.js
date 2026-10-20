const crypto = require('crypto');

/**
 * Comparaison de secrets en temps constant.
 * `a !== b` sur une chaîne s'arrête au premier caractère différent : le temps de
 * réponse fuit alors la longueur du préfixe correct, ce qui permet de reconstruire
 * un secret caractère par caractère. On hache les deux valeurs pour obtenir des
 * buffers de longueur fixe avant la comparaison (timingSafeEqual exige des
 * longueurs égales, sinon il lève une exception qui rétablit la fuite).
 */
const secureCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

module.exports = { secureCompare };
