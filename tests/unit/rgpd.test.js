/**
 * L'effacement RGPD est irréversible : ces tests vérifient qu'il supprime bien tout
 * ce qu'il doit, conserve ce qui relève d'une obligation légale, et ne s'exécute
 * jamais avant la fin du délai de rétractation.
 */
process.env.DATA_ENCRYPTION_KEY = 'c'.repeat(64);

const mongoose = require('mongoose');

// Modèles réellement enregistrés, pour que la découverte dynamique ait de la matière.
require('../../models/Company');
require('../../models/Subscription');
require('../../models/Employee');
require('../../models/Invoice');
require('../../models/User');
require('../../models/Prospect');

const { modelesAPurger, DELAI_RETRACTATION_JOURS } = require('../../services/rgpdService');

describe('Découverte des modèles à purger', () => {
  const noms = () => modelesAPurger().map((m) => m.modelName);

  it('inclut les collections de données clientes', () => {
    for (const attendu of ['Employee', 'Invoice', 'User', 'Prospect']) {
      expect(noms()).toContain(attendu);
    }
  });

  it('exclut Company et Subscription, conservés pour la comptabilité de Novexa', () => {
    expect(noms()).not.toContain('Company');
    expect(noms()).not.toContain('Subscription');
  });

  it('ne retient que des modèles rattachés à une entreprise', () => {
    for (const modele of modelesAPurger()) {
      expect(modele.schema.path('company')).toBeDefined();
    }
  });

  it('découvre les modèles dynamiquement : un modèle ajouté plus tard est purgé', () => {
    const nom = 'ModeleDeTestRgpd';
    if (!mongoose.modelNames().includes(nom)) {
      mongoose.model(nom, new mongoose.Schema({
        company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
        valeur: String
      }));
    }
    expect(noms()).toContain(nom);
  });

  it('ignore un modèle sans rattachement à une entreprise', () => {
    const nom = 'ModeleSansCompany';
    if (!mongoose.modelNames().includes(nom)) {
      mongoose.model(nom, new mongoose.Schema({ valeur: String }));
    }
    expect(noms()).not.toContain(nom);
  });

  it('couvre TOUS les modèles du dossier models/, sans dépendre des imports déjà faits', () => {
    const fs = require('fs');
    const path = require('path');
    const surDisque = fs.readdirSync(path.join(__dirname, '..', '..', 'models'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => f.replace('.js', ''));

    const couverts = new Set(noms());
    const attendus = surDisque.filter((m) => {
      if (['Company', 'Subscription'].includes(m)) return false;
      return Boolean(mongoose.model(m).schema.path('company'));
    });

    const oublies = attendus.filter((m) => !couverts.has(m));
    // Un modèle oublié ici, c'est une donnée personnelle qui survit à l'effacement.
    expect(oublies).toEqual([]);
    expect(attendus.length).toBeGreaterThan(30);
  });
});

describe('Délai de rétractation', () => {
  it('laisse au client le temps de revenir sur sa décision', () => {
    expect(DELAI_RETRACTATION_JOURS).toBeGreaterThanOrEqual(7);
    expect(DELAI_RETRACTATION_JOURS).toBeLessThanOrEqual(30);
  });
});

describe('purgerEntreprise — garde-fous', () => {
  // Même instance de modèle que celle utilisée par le service : pas de resetModules,
  // sinon le service récupérerait un autre modèle et l'espion ne s'appliquerait pas.
  const Company = mongoose.model('Company');
  const rgpd = require('../../services/rgpdService');
  const ID = new mongoose.Types.ObjectId();

  afterEach(() => jest.restoreAllMocks());

  it('refuse de purger une entreprise inexistante', async () => {
    jest.spyOn(Company, 'findById').mockResolvedValue(null);
    await expect(rgpd.purgerEntreprise(ID)).rejects.toThrow(/introuvable/i);
  });

  it('refuse de purger sans demande enregistrée', async () => {
    jest.spyOn(Company, 'findById').mockResolvedValue({ _id: ID, supprimeeLe: null, suppressionDemandeeLe: null });
    await expect(rgpd.purgerEntreprise(ID)).rejects.toThrow(/aucune demande/i);
  });

  it('refuse de purger avant la fin du délai de rétractation', async () => {
    jest.spyOn(Company, 'findById').mockResolvedValue({
      _id: ID,
      supprimeeLe: null,
      suppressionDemandeeLe: new Date(),
      suppressionPrevueLe: new Date(Date.now() + 5 * 86400000)
    });
    await expect(rgpd.purgerEntreprise(ID)).rejects.toThrow(/délai de rétractation/i);
  });

  it('est idempotent : une entreprise déjà purgée n\'est pas retraitée', async () => {
    jest.spyOn(Company, 'findById').mockResolvedValue({ _id: ID, supprimeeLe: new Date() });
    const r = await rgpd.purgerEntreprise(ID);
    expect(r.deja).toBe(true);
  });
});
