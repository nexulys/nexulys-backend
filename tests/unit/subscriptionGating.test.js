const { donneAccesEcriture, motifBlocage } = require('../../middleware/subscription');

const dans = (jours) => new Date(Date.now() + jours * 24 * 60 * 60 * 1000);

describe('donneAccesEcriture — droits d\'écriture selon l\'abonnement', () => {
  it('autorise un abonnement actif', () => {
    expect(donneAccesEcriture({ statut: 'actif' })).toBe(true);
    expect(donneAccesEcriture({ statut: 'active' })).toBe(true);
  });

  it('autorise un essai encore valide', () => {
    expect(donneAccesEcriture({ statut: 'essai', trialEndsAt: dans(3) })).toBe(true);
    expect(donneAccesEcriture({ statut: 'trial', trialEndsAt: dans(1) })).toBe(true);
  });

  it('refuse un essai expiré', () => {
    expect(donneAccesEcriture({ statut: 'essai', trialEndsAt: dans(-1) })).toBe(false);
    expect(donneAccesEcriture({ statut: 'trial', trialEndsAt: dans(-90) })).toBe(false);
  });

  it('refuse un abonnement créé mais non encaissé', () => {
    expect(donneAccesEcriture({ statut: 'en_attente_paiement' })).toBe(false);
  });

  it('refuse un abonnement suspendu, annulé ou inactif', () => {
    for (const statut of ['suspendu', 'annule', 'cancelled', 'inactif']) {
      expect(donneAccesEcriture({ statut })).toBe(false);
    }
  });

  it('tolère l\'absence d\'abonnement (comptes antérieurs au garde)', () => {
    expect(donneAccesEcriture(null)).toBe(true);
    expect(donneAccesEcriture(undefined)).toBe(true);
  });

  it('autorise un essai sans date de fin renseignée', () => {
    expect(donneAccesEcriture({ statut: 'essai' })).toBe(true);
  });
});

describe('motifBlocage', () => {
  it('explique la cause du refus à l\'utilisateur', () => {
    expect(motifBlocage({ statut: 'essai' })).toMatch(/essai/i);
    expect(motifBlocage({ statut: 'en_attente_paiement' })).toMatch(/paiement/i);
    expect(motifBlocage({ statut: 'suspendu' })).toMatch(/suspendu/i);
    expect(motifBlocage({ statut: 'annule' })).toMatch(/annul/i);
    expect(motifBlocage(null)).toMatch(/aucun abonnement/i);
  });
});
