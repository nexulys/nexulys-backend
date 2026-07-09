const { calculerTVA, htDepuisTTC, calculateTVA } = require('../../utils/tvaCalculator');

describe('tvaCalculator', () => {
  describe('calculerTVA', () => {
    it('calcule la TVA à 20% par défaut', () => {
      const r = calculerTVA(100);
      expect(r.tauxTVA).toBe(20);
      expect(r.montantTVA).toBe(20);
      expect(r.montantTTC).toBe(120);
    });

    it('gère un taux réduit (10%)', () => {
      const r = calculerTVA(200, 10);
      expect(r.montantTVA).toBe(20);
      expect(r.montantTTC).toBe(220);
    });

    it('arrondit correctement à 2 décimales', () => {
      const r = calculerTVA(99.99, 20);
      expect(r.montantTVA).toBe(20);
      expect(r.montantTTC).toBe(119.99);
    });

    it('gère un montant nul', () => {
      const r = calculerTVA(0);
      expect(r.montantTVA).toBe(0);
      expect(r.montantTTC).toBe(0);
    });
  });

  describe('htDepuisTTC', () => {
    it('retrouve le HT depuis le TTC (20%)', () => {
      const r = htDepuisTTC(120, 20);
      expect(r.montantHT).toBe(100);
      expect(r.montantTVA).toBe(20);
    });

    it('cohérence aller-retour HT -> TTC -> HT', () => {
      const ttc = calculerTVA(250, 20).montantTTC;
      const ht = htDepuisTTC(ttc, 20).montantHT;
      expect(ht).toBeCloseTo(250, 1);
    });
  });

  describe('calculateTVA (alias EN)', () => {
    it('renvoie tva et total cohérents', () => {
      const r = calculateTVA(100, 20);
      expect(r.tva).toBe(20);
      expect(r.total).toBe(120);
    });
  });
});
