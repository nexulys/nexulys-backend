const { PLANS, DEFAULT_PLAN, getPlan } = require('../../config/plans');

describe('config/plans (grille tarifaire)', () => {
  it('expose 3 offres avec id, nom et prix croissants', () => {
    expect(PLANS).toHaveLength(3);
    const ids = PLANS.map(p => p.id);
    expect(ids).toEqual(['starter', 'business', 'pro']);
    expect(PLANS.map(p => p.prix)).toEqual([1000, 1500, 2000]);
    PLANS.forEach(p => {
      expect(p.nom).toBeTruthy();
      expect(Array.isArray(p.fonctionnalites)).toBe(true);
    });
  });

  it('marque Business comme plan populaire et par défaut', () => {
    expect(DEFAULT_PLAN).toBe('business');
    expect(getPlan('business').populaire).toBe(true);
  });

  it('getPlan retourne le bon plan par id', () => {
    expect(getPlan('pro').prix).toBe(2000);
    expect(getPlan('starter').prix).toBe(1000);
  });

  it('getPlan retombe sur le plan par défaut pour un id inconnu', () => {
    expect(getPlan('inexistant').id).toBe('business');
    expect(getPlan(undefined).id).toBe('business');
  });
});
