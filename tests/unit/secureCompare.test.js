const { secureCompare } = require('../../utils/secureCompare');

describe('secureCompare', () => {
  it('accepte deux secrets identiques', () => {
    expect(secureCompare('s3cr3t-long-enough', 's3cr3t-long-enough')).toBe(true);
  });

  it('refuse des secrets différents, y compris de longueurs différentes', () => {
    expect(secureCompare('secret', 'secrez')).toBe(false);
    expect(secureCompare('secret', 'secret-plus-long')).toBe(false);
    expect(secureCompare('s', 'secret')).toBe(false);
  });

  it('refuse les valeurs vides ou non-chaînes sans lever', () => {
    expect(secureCompare('', '')).toBe(false);
    expect(secureCompare(undefined, 'secret')).toBe(false);
    expect(secureCompare(null, 'secret')).toBe(false);
    expect(secureCompare({}, 'secret')).toBe(false);
    expect(secureCompare('secret', undefined)).toBe(false);
  });
});
