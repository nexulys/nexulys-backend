const { genererFichePaie, PMSS_2024, HEURES_LEGALES } = require('../../utils/payslipGenerator');

describe('genererFichePaie (bulletin de paie France 2024)', () => {
  describe('rémunération brute', () => {
    it('calcule le taux horaire et le brut de base', () => {
      const f = genererFichePaie(2000);
      expect(f.heuresBase).toBe(HEURES_LEGALES);
      expect(f.tauxHoraire).toBeCloseTo(2000 / HEURES_LEGALES, 1);
      expect(f.salaireBrut).toBe(2000);
    });

    it('ajoute les heures supplémentaires majorées 25%', () => {
      const f = genererFichePaie(2000, 10);
      expect(f.heuresSupplementaires).toBe(10);
      expect(f.montantHeuresSup).toBeGreaterThan(0);
      expect(f.salaireBrut).toBeGreaterThan(2000);
    });

    it('intègre les primes au brut', () => {
      const f = genererFichePaie(2000, 0, null, 300);
      expect(f.salaireBrut).toBe(2300);
    });
  });

  describe('cotisations', () => {
    it('produit le détail des lignes de cotisations par catégorie', () => {
      const f = genererFichePaie(2500);
      expect(Array.isArray(f.lignesCotisations)).toBe(true);
      expect(f.lignesCotisations.length).toBeGreaterThanOrEqual(10);
      const cats = new Set(f.lignesCotisations.map(l => l.categorie));
      ['Santé', 'Retraite', 'Famille', 'Chômage', 'CSG/CRDS'].forEach(c => {
        expect(cats.has(c)).toBe(true);
      });
    });

    it('le net avant impôt est inférieur au brut (cotisations prélevées)', () => {
      const f = genererFichePaie(3000);
      expect(f.netAvantImpot).toBeLessThan(f.salaireBrut);
      expect(f.cotisationsSalariales.total).toBeGreaterThan(0);
      expect(f.cotisationsPatronales.total).toBeGreaterThan(0);
    });

    it("l'assurance chômage salariale est à 0% (correct depuis 2019)", () => {
      const f = genererFichePaie(3000);
      const chomage = f.lignesCotisations.find(l => /chômage/i.test(l.libelle));
      expect(chomage).toBeDefined();
      expect(chomage.montantSalarial).toBe(0);
    });
  });

  describe('prélèvement à la source (PAS)', () => {
    it("n'applique aucun PAS avec un taux à 0", () => {
      const f = genererFichePaie(3000, 0, null, 0, 0);
      expect(f.montantPAS).toBe(0);
      expect(f.netAPayer).toBe(f.netAvantImpot);
    });

    it('applique le PAS sur le net imposable', () => {
      const f = genererFichePaie(3000, 0, null, 0, 0.075);
      expect(f.montantPAS).toBeCloseTo(f.netImposable * 0.075, 1);
      expect(f.netAPayer).toBeCloseTo(f.netAvantImpot - f.montantPAS, 1);
    });

    it('le net imposable est supérieur au net avant impôt (CSG/CRDS non déductibles réintégrées)', () => {
      const f = genererFichePaie(3000);
      expect(f.netImposable).toBeGreaterThan(f.netAvantImpot);
    });
  });

  describe('autres éléments (transport, titres-resto, télétravail)', () => {
    it('ajoute au net les montants positifs et déduit les négatifs', () => {
      const base = genererFichePaie(3000);
      const f = genererFichePaie(3000, 0, null, 0, 0, {
        autresElements: [
          { libelle: 'Transport', montant: 32.6 },
          { libelle: 'Titres-resto', montant: -79.2 }
        ]
      });
      expect(f.autresElements).toHaveLength(2);
      expect(f.netAPayer).toBeCloseTo(base.netAPayer + 32.6 - 79.2, 1);
    });

    it('ignore les éléments invalides', () => {
      const f = genererFichePaie(3000, 0, null, 0, 0, {
        autresElements: [{ libelle: '', montant: 10 }, { libelle: 'X', montant: 'abc' }]
      });
      expect(f.autresElements).toHaveLength(0);
    });
  });

  describe('congés payés', () => {
    it('acquiert 2,5 jours par mois et calcule le solde', () => {
      const f = genererFichePaie(2000, 0, null, 0, 0, { congesDebut: 10, congesPris: 3 });
      expect(f.congesPayes.acquis).toBe(2.5);
      expect(f.congesPayes.soldeEnDebut).toBe(10);
      expect(f.congesPayes.pris).toBe(3);
      expect(f.congesPayes.solde).toBeCloseTo(10 + 2.5 - 3, 2);
    });
  });

  it('expose le plafond PMSS 2024', () => {
    expect(PMSS_2024).toBe(3864);
  });
});
