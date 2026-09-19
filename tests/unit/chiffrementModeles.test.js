/**
 * Vérifie que le chiffrement est bien appliqué par les schémas Mongoose : valeur
 * chiffrée dans le document stocké, valeur claire à la lecture et à la sérialisation.
 * Aucune connexion n'est nécessaire — les setters et getters s'appliquent à
 * l'instanciation du document.
 */
process.env.DATA_ENCRYPTION_KEY = 'b'.repeat(64);

const mongoose = require('mongoose');
const Employee = require('../../models/Employee');
const Company = require('../../models/Company');
const Virement = require('../../models/Virement');
const { estChiffre } = require('../../utils/chiffrement');

const IBAN = 'FR7630006000011234567890189';
const NIR = '184127645108946';

/** Valeur réellement stockée, getters court-circuités. */
const brut = (doc, champ) => doc.get(champ, null, { getters: false });

afterAll(async () => { await mongoose.disconnect().catch(() => {}); });

describe('Employee', () => {
  const employe = () => new Employee({
    company: new mongoose.Types.ObjectId(),
    nom: 'Durand', prenom: 'Alice', email: 'a@b.fr', poste: 'Dev',
    salaireBase: 3000, dateEmbauche: new Date('2022-01-01'),
    numeroSecu: NIR, iban: IBAN
  });

  it('stocke le NIR et l\'IBAN chiffrés', () => {
    const e = employe();
    expect(estChiffre(brut(e, 'numeroSecu'))).toBe(true);
    expect(estChiffre(brut(e, 'iban'))).toBe(true);
    expect(brut(e, 'iban')).not.toContain('1234567890189');
  });

  it('restitue les valeurs en clair à la lecture', () => {
    const e = employe();
    expect(e.numeroSecu).toBe(NIR);
    expect(e.iban).toBe(IBAN);
  });

  it('sérialise en clair, pour ne pas casser les réponses API', () => {
    const json = employe().toJSON();
    expect(json.iban).toBe(IBAN);
    expect(json.numeroSecu).toBe(NIR);
  });

  it('laisse les champs absents à undefined', () => {
    const e = new Employee({
      company: new mongoose.Types.ObjectId(),
      nom: 'X', prenom: 'Y', email: 'x@y.fr', poste: 'Dev',
      salaireBase: 1, dateEmbauche: new Date()
    });
    expect(e.iban).toBeUndefined();
    expect(e.numeroSecu).toBeUndefined();
  });
});

describe('Company', () => {
  it('chiffre l\'IBAN de l\'entreprise et le restitue en clair', () => {
    const c = new Company({ nom: 'ACME', iban: IBAN });
    expect(estChiffre(brut(c, 'iban'))).toBe(true);
    expect(c.iban).toBe(IBAN);
    expect(c.toJSON().iban).toBe(IBAN);
  });
});

describe('Virement', () => {
  it('chiffre les IBAN imbriqués dans les lignes', () => {
    const v = new Virement({
      company: new mongoose.Types.ObjectId(), mois: 6, annee: 2026,
      lignes: [{ employeeNom: 'Alice', iban: IBAN, montant: 2500, statut: 'effectue' }]
    });
    expect(estChiffre(v.lignes[0].get('iban', null, { getters: false }))).toBe(true);
    expect(v.lignes[0].iban).toBe(IBAN);
    expect(v.toJSON().lignes[0].iban).toBe(IBAN);
  });

  it('gère une ligne sans IBAN', () => {
    const v = new Virement({
      company: new mongoose.Types.ObjectId(), mois: 6, annee: 2026,
      lignes: [{ employeeNom: 'Bob', montant: 0, statut: 'sans_iban' }]
    });
    expect(v.lignes[0].iban).toBeUndefined();
  });
});
