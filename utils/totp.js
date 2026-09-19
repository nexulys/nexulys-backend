const crypto = require('crypto');

/**
 * TOTP (RFC 6238) — second facteur du back-office plateforme.
 * Implémenté sur le crypto natif de Node : aucune dépendance supplémentaire,
 * et compatible Google Authenticator / 1Password / Authy (SHA-1, 6 chiffres, 30 s).
 */

const PAS = 30;           // fenêtre, en secondes
const CHIFFRES = 6;
const DERIVE = 1;         // ±1 fenêtre tolérée (dérive d'horloge du téléphone)

/** Décode une clé Base32 (alphabet RFC 4648, sans padding) en Buffer. */
const decodeBase32 = (secret) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const propre = String(secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valeur = 0;
  const octets = [];
  for (const c of propre) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) continue;
    valeur = (valeur << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
};

/** Code TOTP pour un compteur de fenêtre donné (HOTP, RFC 4226). */
const hotp = (cle, compteur) => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(compteur));
  const hmac = crypto.createHmac('sha1', cle).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaire = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binaire % 10 ** CHIFFRES).padStart(CHIFFRES, '0');
};

/**
 * Vérifie un code saisi contre le secret Base32.
 * Comparaison en temps constant, et tolérance de ±1 fenêtre.
 */
const verifierTotp = (secretBase32, code) => {
  const saisi = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(saisi)) return false;
  const cle = decodeBase32(secretBase32);
  if (!cle.length) return false;

  const fenetre = Math.floor(Date.now() / 1000 / PAS);
  for (let d = -DERIVE; d <= DERIVE; d++) {
    const attendu = hotp(cle, fenetre + d);
    const a = Buffer.from(attendu);
    const b = Buffer.from(saisi);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
};

/** Génère un secret Base32 (160 bits) pour l'enrôlement d'une application. */
const genererSecret = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const octets = crypto.randomBytes(20);
  let bits = 0;
  let valeur = 0;
  let out = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(valeur << (5 - bits)) & 31];
  return out;
};

/** URI d'enrôlement à encoder en QR code. */
const uriEnrolement = (secret, compte = 'admin', emetteur = 'Novexa') =>
  `otpauth://totp/${encodeURIComponent(emetteur)}:${encodeURIComponent(compte)}` +
  `?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=${CHIFFRES}&period=${PAS}`;

module.exports = { verifierTotp, genererSecret, uriEnrolement, decodeBase32, hotp };
