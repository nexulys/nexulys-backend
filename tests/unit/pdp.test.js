const pdpService = require('../../services/pdpService');

// On sauvegarde/restaure l'environnement pour ne pas polluer les autres tests.
const saveEnv = () => ({ ...process.env });
const clearPdpEnv = () => {
  delete process.env.PDP_PROVIDER;
  delete process.env.PDP_BASE_URL;
  delete process.env.PDP_API_KEY;
  delete process.env.PDP_ENV;
};

describe('pdpService — couche d\'abstraction PDP', () => {
  let snapshot;
  beforeEach(() => { snapshot = saveEnv(); clearPdpEnv(); });
  afterEach(() => { process.env = snapshot; });

  describe('isConfigured', () => {
    it('est faux sans URL ni clé', () => {
      expect(pdpService.isConfigured()).toBe(false);
    });
    it('exige à la fois l\'URL et la clé', () => {
      process.env.PDP_BASE_URL = 'https://pdp.example';
      expect(pdpService.isConfigured()).toBe(false);
      process.env.PDP_API_KEY = 'secret';
      expect(pdpService.isConfigured()).toBe(true);
    });
  });

  describe('normaliserStatut', () => {
    it('mappe les alias anglais vers le vocabulaire normalisé', () => {
      expect(pdpService.normaliserStatut('submitted')).toBe('deposee');
      expect(pdpService.normaliserStatut('paid')).toBe('encaissee');
      expect(pdpService.normaliserStatut('rejected')).toBe('rejetee');
      expect(pdpService.normaliserStatut('taken in charge')).toBe('prise_en_charge');
    });
    it('accepte directement les clés normalisées', () => {
      expect(pdpService.normaliserStatut('encaissee')).toBe('encaissee');
      expect(pdpService.normaliserStatut('mise_a_disposition')).toBe('mise_a_disposition');
    });
    it('retombe sur "non_transmise" pour une valeur vide', () => {
      expect(pdpService.normaliserStatut('')).toBe('non_transmise');
      expect(pdpService.normaliserStatut(null)).toBe('non_transmise');
    });
    it('préserve une valeur inconnue plutôt que de la perdre', () => {
      expect(pdpService.normaliserStatut('etat_exotique')).toBe('etat_exotique');
    });
  });

  describe('dégradation propre quand non configuré', () => {
    const invoice = { numero: 'FAC-1', montantTTC: 1200, client: { nom: 'X' } };

    it('emettreFacture ne jette pas et renvoie configured:false', async () => {
      const r = await pdpService.emettreFacture(invoice, {});
      expect(r.configured).toBe(false);
      expect(r.transmitted).toBe(false);
      expect(r.statut).toBe('non_transmise');
      expect(typeof r.message).toBe('string');
    });

    it('statutFacture renvoie configured:false', async () => {
      const r = await pdpService.statutFacture('abc');
      expect(r.configured).toBe(false);
    });

    it('recevoirFactures renvoie une liste vide', async () => {
      const r = await pdpService.recevoirFactures();
      expect(r.configured).toBe(false);
      expect(r.factures).toEqual([]);
    });
  });

  describe('infos', () => {
    it('n\'expose jamais la clé API', () => {
      process.env.PDP_BASE_URL = 'https://pdp.example';
      process.env.PDP_API_KEY = 'super-secret';
      process.env.PDP_PROVIDER = 'iopole';
      const i = pdpService.infos();
      expect(i.configured).toBe(true);
      expect(i.provider).toBe('iopole');
      expect(JSON.stringify(i)).not.toContain('super-secret');
      expect(i.statuts.encaissee).toBe('Encaissée');
    });
  });
});
