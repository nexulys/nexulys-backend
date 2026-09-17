const crypto = require('crypto');
const { verifierTotp, genererSecret, uriEnrolement, decodeBase32, hotp } = require('../../utils/totp');

// Encode un Buffer en Base32 pour rejouer les vecteurs de la RFC avec notre API.
const enBase32 = (buf) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, valeur = 0, out = '';
  for (const o of buf) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) { out += alphabet[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += alphabet[(valeur << (5 - bits)) & 31];
  return out;
};

describe('TOTP — conformité RFC 4226 / 6238', () => {
  // RFC 4226, annexe D : secret ASCII "12345678901234567890", compteurs 0 à 9.
  const cleRfc = Buffer.from('12345678901234567890', 'ascii');
  const attendus = ['755224', '287082', '359152', '969429', '338314',
                    '254676', '287922', '162583', '399871', '520489'];

  it.each(attendus.map((code, i) => [i, code]))(
    'HOTP compteur %i vaut %s', (compteur, code) => {
      expect(hotp(cleRfc, compteur)).toBe(code);
    });

  it('decodeBase32 est l\'inverse de l\'encodage', () => {
    const buf = crypto.randomBytes(20);
    expect(decodeBase32(enBase32(buf)).equals(buf)).toBe(true);
  });

  it('tolère les espaces et la casse dans le secret', () => {
    const b32 = enBase32(cleRfc);
    expect(decodeBase32(b32.toLowerCase()).equals(cleRfc)).toBe(true);
    expect(decodeBase32(b32.replace(/(.{4})/g, '$1 ')).equals(cleRfc)).toBe(true);
  });
});

describe('verifierTotp', () => {
  const secret = genererSecret();

  /** Code valide pour la fenêtre courante décalée de `derive` pas de 30 s. */
  const codeCourant = (derive = 0) =>
    hotp(decodeBase32(secret), Math.floor(Date.now() / 1000 / 30) + derive);

  it('accepte le code de la fenêtre courante', () => {
    expect(verifierTotp(secret, codeCourant())).toBe(true);
  });

  it('tolère une dérive d\'une fenêtre dans les deux sens', () => {
    expect(verifierTotp(secret, codeCourant(-1))).toBe(true);
    expect(verifierTotp(secret, codeCourant(1))).toBe(true);
  });

  it('refuse au-delà de la tolérance', () => {
    expect(verifierTotp(secret, codeCourant(5))).toBe(false);
    expect(verifierTotp(secret, codeCourant(-5))).toBe(false);
  });

  it('refuse un code malformé ou vide sans lever', () => {
    for (const mauvais of ['', null, undefined, 'abcdef', '12345', '1234567', {}, '000000']) {
      expect(verifierTotp(secret, mauvais)).toBe(false);
    }
  });

  it('refuse un code valide pour un autre secret', () => {
    const autre = genererSecret();
    const codeAutre = hotp(decodeBase32(autre), Math.floor(Date.now() / 1000 / 30));
    expect(verifierTotp(secret, codeAutre)).toBe(false);
  });

  it('refuse si le secret est absent ou invalide', () => {
    expect(verifierTotp('', codeCourant())).toBe(false);
    expect(verifierTotp(null, codeCourant())).toBe(false);
  });
});

describe('genererSecret / uriEnrolement', () => {
  it('produit un secret Base32 de 32 caractères (160 bits)', () => {
    const s = genererSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('produit un secret différent à chaque appel', () => {
    expect(genererSecret()).not.toBe(genererSecret());
  });

  it('produit une URI otpauth exploitable par une application d\'authentification', () => {
    const uri = uriEnrolement('JBSWY3DPEHPK3PXP', 'admin@novexa.fr');
    expect(uri).toContain('otpauth://totp/Novexa:admin%40novexa.fr');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
