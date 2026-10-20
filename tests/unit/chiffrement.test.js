const crypto = require('crypto');

const CLE = 'a'.repeat(64);
const AUTRE_CLE = crypto.randomBytes(32).toString('hex');
const IBAN = 'FR7630006000011234567890189';
const NIR = '1 84 12 76 451 089 46';

const charger = (cle) => {
  jest.resetModules();
  if (cle === null) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = cle;
  return require('../../utils/chiffrement');
};

const CLE_INITIALE = process.env.DATA_ENCRYPTION_KEY;
afterAll(() => {
  if (CLE_INITIALE === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = CLE_INITIALE;
});

describe('chiffrement des données sensibles', () => {
  it('restitue la valeur d\'origine après un aller-retour', () => {
    const { chiffrer, dechiffrer } = charger(CLE);
    expect(dechiffrer(chiffrer(IBAN))).toBe(IBAN);
    expect(dechiffrer(chiffrer(NIR))).toBe(NIR);
  });

  it('ne laisse pas la valeur en clair dans le texte chiffré', () => {
    const { chiffrer } = charger(CLE);
    const chiffre = chiffrer(IBAN);
    expect(chiffre).not.toContain(IBAN);
    expect(chiffre).not.toContain('1234567890189');
    expect(chiffre.startsWith('enc:v1:')).toBe(true);
  });

  it('produit un texte différent à chaque écriture (IV aléatoire)', () => {
    const { chiffrer, dechiffrer } = charger(CLE);
    const a = chiffrer(IBAN);
    const b = chiffrer(IBAN);
    expect(a).not.toBe(b);
    // …tout en restant déchiffrable des deux côtés.
    expect(dechiffrer(a)).toBe(IBAN);
    expect(dechiffrer(b)).toBe(IBAN);
  });

  it('est idempotent : rechiffrer une valeur déjà chiffrée ne l\'altère pas', () => {
    const { chiffrer, dechiffrer } = charger(CLE);
    const une = chiffrer(IBAN);
    const deux = chiffrer(une);
    expect(deux).toBe(une);
    expect(dechiffrer(deux)).toBe(IBAN);
  });

  it('laisse passer les valeurs vides sans les transformer', () => {
    const { chiffrer, dechiffrer } = charger(CLE);
    for (const vide of ['', null, undefined]) {
      expect(chiffrer(vide)).toBe(vide);
      expect(dechiffrer(vide)).toBe(vide);
    }
  });

  it('rend telle quelle une valeur en clair antérieure à la migration', () => {
    const { dechiffrer } = charger(CLE);
    expect(dechiffrer(IBAN)).toBe(IBAN);
  });

  it('refuse de déchiffrer avec une autre clé plutôt que de renvoyer une valeur fausse', () => {
    const { chiffrer } = charger(CLE);
    const chiffre = chiffrer(IBAN);
    const { dechiffrer } = charger(AUTRE_CLE);
    expect(dechiffrer(chiffre)).toBeNull();
  });

  it('détecte une altération du stockage (chiffrement authentifié)', () => {
    const { chiffrer, dechiffrer, PREFIXE } = charger(CLE);
    const chiffre = chiffrer(IBAN);
    const brut = Buffer.from(chiffre.slice(PREFIXE.length), 'base64');
    brut[brut.length - 1] ^= 0xff; // un octet modifié
    expect(dechiffrer(PREFIXE + brut.toString('base64'))).toBeNull();
  });

  it('rejette une clé de format invalide plutôt que de chiffrer faiblement', () => {
    const { chiffrer } = charger('trop-courte');
    expect(() => chiffrer(IBAN)).toThrow(/DATA_ENCRYPTION_KEY invalide/);
  });

  it('sans clé, conserve la donnée en clair plutôt que de la perdre', () => {
    const { chiffrer } = charger(null);
    expect(chiffrer(IBAN)).toBe(IBAN);
  });

  it('accepte une clé en majuscules ou avec des espaces', () => {
    const { chiffrer } = charger(CLE);
    const reference = chiffrer(IBAN);
    const { dechiffrer } = charger(`  ${CLE.toUpperCase()}  `);
    expect(dechiffrer(reference)).toBe(IBAN);
  });
});

describe('masquer', () => {
  it('ne révèle que le début et la fin', () => {
    const { masquer } = charger(CLE);
    expect(masquer(IBAN)).toBe('FR76****0189');
    expect(masquer('court')).toBe('****');
    expect(masquer('')).toBe('');
  });
});
