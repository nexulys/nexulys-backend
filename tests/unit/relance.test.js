const { niveauRelance } = require('../../services/relanceService');

describe('niveauRelance (escalade des relances de paiement)', () => {
  it("ne relance pas si l'échéance n'est pas dépassée", () => {
    expect(niveauRelance(0)).toBeNull();
    expect(niveauRelance(-5)).toBeNull();
  });

  it('applique J7 pour un retard court (1-10 jours)', () => {
    expect(niveauRelance(1)).toBe('J7');
    expect(niveauRelance(10)).toBe('J7');
  });

  it('applique J15 pour un retard moyen (11-20 jours)', () => {
    expect(niveauRelance(11)).toBe('J15');
    expect(niveauRelance(20)).toBe('J15');
  });

  it('applique J30 pour un retard long (> 20 jours)', () => {
    expect(niveauRelance(21)).toBe('J30');
    expect(niveauRelance(90)).toBe('J30');
  });
});
