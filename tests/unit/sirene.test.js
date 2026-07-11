const { tvaIntracom } = require('../../utils/sirene');

describe('tvaIntracom (numéro de TVA intracommunautaire FR)', () => {
  it('calcule la clé correcte pour un SIREN valide', () => {
    // SIREN 404833048 -> clé (12 + 3*(404833048 % 97)) % 97
    const siren = '404833048';
    const cle = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
    const expected = `FR${String(cle).padStart(2, '0')}${siren}`;
    expect(tvaIntracom(siren)).toBe(expected);
    expect(tvaIntracom(siren)).toMatch(/^FR\d{2}\d{9}$/);
  });

  it('retourne une chaîne vide pour un SIREN invalide', () => {
    expect(tvaIntracom('')).toBe('');
    expect(tvaIntracom('123')).toBe('');
    expect(tvaIntracom('abcdefghi')).toBe('');
    expect(tvaIntracom(null)).toBe('');
  });
});
