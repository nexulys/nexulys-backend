const crypto = require('crypto');
const logger = require('./logger');

/**
 * Chiffrement applicatif des données sensibles (IBAN, numéro de sécurité sociale).
 *
 * Objectif : qu'un dump de la base, une sauvegarde égarée ou un accès non autorisé à
 * MongoDB ne livre pas ces données en clair. Le NIR relève en France d'un régime
 * particulier et l'IBAN est une donnée bancaire : les stocker en clair exposait à une
 * notification CNIL et à une sanction en cas de fuite.
 *
 * AES-256-GCM : chiffrement authentifié, donc toute altération du stockage est
 * détectée au déchiffrement plutôt que de produire silencieusement une valeur fausse.
 * L'IV est aléatoire à chaque écriture — ces champs ne peuvent donc pas être indexés
 * ni recherchés par égalité, ce qu'aucun usage du code ne fait.
 */

const PREFIXE = 'enc:v1:';
const LONGUEUR_IV = 12;   // 96 bits, recommandé pour GCM
const LONGUEUR_TAG = 16;

let cleCache = null;

/** Clé 256 bits depuis DATA_ENCRYPTION_KEY (64 caractères hexadécimaux). */
const cle = () => {
  if (cleCache) return cleCache;
  const brute = process.env.DATA_ENCRYPTION_KEY;
  if (!brute) return null;
  const propre = brute.trim();
  if (!/^[0-9a-f]{64}$/i.test(propre)) {
    throw new Error('DATA_ENCRYPTION_KEY invalide : 64 caractères hexadécimaux attendus (générez-la avec `npm run generate:key`).');
  }
  cleCache = Buffer.from(propre, 'hex');
  return cleCache;
};

/** Réinitialise le cache de clé — utilisé par les tests. */
const reinitialiserCle = () => { cleCache = null; };

const estChiffre = (valeur) => typeof valeur === 'string' && valeur.startsWith(PREFIXE);

/**
 * Chiffre une valeur. Idempotent : une valeur déjà chiffrée est renvoyée telle quelle,
 * ce qui rend la migration rejouable sans double chiffrement.
 */
const chiffrer = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === '') return valeur;
  const texte = String(valeur);
  if (estChiffre(texte)) return texte;

  const k = cle();
  if (!k) {
    // Sans clé, on stocke en clair plutôt que de perdre la donnée. Le serveur refuse
    // de démarrer dans cet état en production (voir server.js).
    return texte;
  }

  const iv = crypto.randomBytes(LONGUEUR_IV);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', k, iv);
  const donnees = Buffer.concat([chiffreur.update(texte, 'utf8'), chiffreur.final()]);
  const tag = chiffreur.getAuthTag();
  return PREFIXE + Buffer.concat([iv, tag, donnees]).toString('base64');
};

/**
 * Déchiffre une valeur. Une valeur non préfixée est rendue telle quelle : les données
 * antérieures à la migration restent donc lisibles pendant la bascule.
 */
const dechiffrer = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === '') return valeur;
  const texte = String(valeur);
  if (!estChiffre(texte)) return texte;

  const k = cle();
  if (!k) {
    logger.error('Donnée chiffrée illisible : DATA_ENCRYPTION_KEY absente.');
    return null;
  }

  try {
    const brut = Buffer.from(texte.slice(PREFIXE.length), 'base64');
    const iv = brut.subarray(0, LONGUEUR_IV);
    const tag = brut.subarray(LONGUEUR_IV, LONGUEUR_IV + LONGUEUR_TAG);
    const donnees = brut.subarray(LONGUEUR_IV + LONGUEUR_TAG);
    const dechiffreur = crypto.createDecipheriv('aes-256-gcm', k, iv);
    dechiffreur.setAuthTag(tag);
    return dechiffreur.update(donnees, undefined, 'utf8') + dechiffreur.final('utf8');
  } catch (err) {
    // Mauvaise clé ou donnée altérée : ne jamais renvoyer une valeur douteuse.
    logger.error('Échec du déchiffrement d\'une donnée sensible', { error: err.message });
    return null;
  }
};

/** Masque une valeur pour l'affichage ou les journaux : FR76 **** 1234. */
const masquer = (valeur) => {
  const texte = String(valeur ?? '');
  if (texte.length <= 8) return texte ? '****' : '';
  return `${texte.slice(0, 4)}****${texte.slice(-4)}`;
};

/** Champ Mongoose chiffré au repos, transparent en lecture. */
const champChiffre = (options = {}) => ({
  type: String,
  set: chiffrer,
  get: dechiffrer,
  ...options
});

module.exports = { chiffrer, dechiffrer, estChiffre, masquer, champChiffre, reinitialiserCle, PREFIXE };
