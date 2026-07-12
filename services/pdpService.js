/**
 * Couche d'abstraction PDP (Plateforme de Dématérialisation Partenaire).
 *
 * La réforme française de la facturation électronique impose que les factures B2B
 * transitent par une PDP immatriculée par la DGFiP. Novexa ne cherche PAS à être une PDP
 * (métier réglementé) : il s'y *connecte*. Ce service isole tout le backend derrière une
 * interface générique — émission, réception, suivi du cycle de vie — pour qu'un seul
 * fichier (l'adaptateur) soit à ajuster le jour où une PDP est retenue.
 *
 * Configuration (variables d'environnement, jamais dans le code) :
 *   PDP_PROVIDER   nom de la PDP retenue (ex. "iopole", "pennylane"…) — libre, pour traçabilité
 *   PDP_BASE_URL   URL racine de l'API de la PDP
 *   PDP_API_KEY    clé API / jeton d'accès fourni par la PDP
 *   PDP_ENV        "sandbox" (défaut) ou "production"
 *   PDP_EMIT_PATH  chemin d'émission (défaut "/invoices")   — surchargeable selon la PDP
 *   PDP_STATUS_PATH chemin de suivi     (défaut "/invoices/:id/status")
 *   PDP_INBOX_PATH  chemin de réception (défaut "/invoices/inbound")
 *
 * Tant qu'aucune PDP n'est configurée, le service se dégrade proprement : il renvoie
 * `configured:false` sans jamais planter, exactement comme stripeService en mode mock.
 */

const logger = require('../utils/logger');
const { genererFacturXXML } = require('../utils/facturx');

// Statuts du cycle de vie normalisés par la réforme (les 4 premiers sont obligatoires).
// On expose un vocabulaire stable côté Novexa ; l'adaptateur traduit les codes propres
// à chaque PDP vers ces clés.
const STATUTS_CYCLE = {
  deposee: 'Déposée',
  recue: 'Reçue par la plateforme',
  mise_a_disposition: 'Mise à disposition',
  prise_en_charge: 'Prise en charge',
  approuvee: 'Approuvée',
  approuvee_partiellement: 'Approuvée partiellement',
  en_litige: 'En litige',
  suspendue: 'Suspendue',
  refusee: 'Refusée',
  rejetee: 'Rejetée',
  encaissee: 'Encaissée',
  non_transmise: 'Non transmise'
};

const isConfigured = () =>
  Boolean(process.env.PDP_BASE_URL && process.env.PDP_API_KEY);

const providerName = () => process.env.PDP_PROVIDER || (isConfigured() ? 'pdp' : null);

const env = () => (process.env.PDP_ENV === 'production' ? 'production' : 'sandbox');

// Traduit un statut brut renvoyé par la PDP vers notre vocabulaire normalisé.
// Beaucoup de PDP utilisent des libellés proches ; on couvre les cas fréquents et on
// retombe sur la valeur brute si inconnue (jamais de perte d'information).
const normaliserStatut = (raw) => {
  if (!raw) return 'non_transmise';
  const k = String(raw).toLowerCase().replace(/[\s-]+/g, '_');
  if (STATUTS_CYCLE[k]) return k;
  const alias = {
    submitted: 'deposee', sent: 'deposee', emitted: 'deposee', deposited: 'deposee',
    received: 'recue', accepted: 'approuvee', approved: 'approuvee',
    available: 'mise_a_disposition', in_hand: 'prise_en_charge', taken_in_charge: 'prise_en_charge',
    partially_approved: 'approuvee_partiellement', disputed: 'en_litige',
    suspended: 'suspendue', refused: 'refusee', rejected: 'rejetee',
    paid: 'encaissee', cashed: 'encaissee'
  };
  return alias[k] || k;
};

// Appel HTTP générique vers la PDP, borné dans le temps, jamais bloquant pour le reste
// de l'application. Toute erreur est capturée et remontée sous forme structurée.
const call = async (path, { method = 'GET', body } = {}) => {
  const base = process.env.PDP_BASE_URL.replace(/\/+$/, '');
  const url = base + (path.startsWith('/') ? path : '/' + path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${process.env.PDP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && (data.message || data.error)) || `HTTP ${res.status}`, data };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? 'Délai dépassé (PDP injoignable)' : err.message };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Émet une facture via la PDP. Produit le Factur-X (déjà conforme EN 16931) et le
 * transmet. En l'absence de configuration, renvoie une réponse dégradée exploitable
 * par l'UI (aucune exception).
 *
 * @returns {Promise<{configured:boolean, transmitted:boolean, transmissionId?:string,
 *   statut:string, statutLabel:string, provider?:string, env?:string, error?:string, message?:string}>}
 */
const emettreFacture = async (invoice, company) => {
  if (!isConfigured()) {
    return {
      configured: false,
      transmitted: false,
      statut: 'non_transmise',
      statutLabel: STATUTS_CYCLE.non_transmise,
      message: "Aucune PDP configurée. Renseignez PDP_BASE_URL et PDP_API_KEY pour activer la transmission."
    };
  }
  const xml = genererFacturXXML(invoice, company || {});
  const payload = {
    format: 'factur-x',
    profile: 'en16931',
    number: invoice.numero,
    // On envoie le XML encodé en base64 (contrat le plus répandu) + les métadonnées
    // essentielles, ce qui suffit à la plupart des PDP pour router la facture.
    content_base64: Buffer.from(xml, 'utf8').toString('base64'),
    seller: { name: company?.nom, siret: company?.siret, vat: company?.tvaIntra },
    buyer: { name: invoice.client?.nom, siret: invoice.client?.siret, email: invoice.client?.email },
    total_incl_tax: Number(invoice.montantTTC) || 0,
    currency: 'EUR'
  };
  const path = process.env.PDP_EMIT_PATH || '/invoices';
  const r = await call(path, { method: 'POST', body: payload });
  if (!r.ok) {
    logger.warn('PDP émission échouée', { provider: providerName(), facture: invoice.numero, error: r.error });
    return {
      configured: true, transmitted: false, provider: providerName(), env: env(),
      statut: 'non_transmise', statutLabel: STATUTS_CYCLE.non_transmise, error: r.error
    };
  }
  const d = r.data || {};
  const transmissionId = d.id || d.transmission_id || d.uuid || d.reference || null;
  const statut = normaliserStatut(d.status || d.statut || 'deposee');
  logger.info('PDP émission réussie', { provider: providerName(), facture: invoice.numero, transmissionId });
  return {
    configured: true, transmitted: true, provider: providerName(), env: env(),
    transmissionId, statut, statutLabel: STATUTS_CYCLE[statut] || statut
  };
};

/**
 * Interroge le cycle de vie d'une facture précédemment transmise.
 */
const statutFacture = async (transmissionId) => {
  if (!isConfigured()) {
    return { configured: false, statut: 'non_transmise', statutLabel: STATUTS_CYCLE.non_transmise };
  }
  if (!transmissionId) {
    return { configured: true, statut: 'non_transmise', statutLabel: STATUTS_CYCLE.non_transmise };
  }
  const tpl = process.env.PDP_STATUS_PATH || '/invoices/:id/status';
  const path = tpl.replace(':id', encodeURIComponent(transmissionId));
  const r = await call(path);
  if (!r.ok) {
    return { configured: true, provider: providerName(), error: r.error, statut: 'non_transmise', statutLabel: STATUTS_CYCLE.non_transmise };
  }
  const d = r.data || {};
  const statut = normaliserStatut(d.status || d.statut);
  return { configured: true, provider: providerName(), transmissionId, statut, statutLabel: STATUTS_CYCLE[statut] || statut, raw: d.status || d.statut };
};

/**
 * Récupère les factures fournisseurs entrantes (réception — obligatoire dès sept. 2026).
 * Renvoie une liste normalisée, vide si non configuré.
 */
const recevoirFactures = async () => {
  if (!isConfigured()) return { configured: false, factures: [] };
  const path = process.env.PDP_INBOX_PATH || '/invoices/inbound';
  const r = await call(path);
  if (!r.ok) {
    return { configured: true, provider: providerName(), error: r.error, factures: [] };
  }
  const d = r.data || {};
  const list = Array.isArray(d) ? d : (d.invoices || d.data || d.results || []);
  const factures = list.map((f) => ({
    id: f.id || f.transmission_id || f.uuid || null,
    numero: f.number || f.numero || null,
    fournisseur: f.seller?.name || f.supplier || f.emetteur || null,
    montantTTC: Number(f.total_incl_tax || f.montantTTC || 0),
    dateReception: f.received_at || f.date || null,
    statut: normaliserStatut(f.status || f.statut)
  }));
  return { configured: true, provider: providerName(), factures };
};

// État de la configuration (pour l'UI / diagnostic), sans jamais exposer la clé.
const infos = () => ({
  configured: isConfigured(),
  provider: providerName(),
  env: isConfigured() ? env() : null,
  statuts: STATUTS_CYCLE
});

module.exports = {
  STATUTS_CYCLE,
  isConfigured,
  providerName,
  normaliserStatut,
  emettreFacture,
  statutFacture,
  recevoirFactures,
  infos
};
