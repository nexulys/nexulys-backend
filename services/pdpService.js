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
 *   PDP_PROVIDER      nom de la PDP retenue ("iopole" active l'adaptateur dédié)
 *   PDP_BASE_URL      URL racine de l'API (facultatif pour iopole : défauts sandbox/prod)
 *   PDP_API_KEY       clé/jeton statique (option 1)
 *   PDP_CLIENT_ID     identifiant OAuth2 client_credentials (option 2)
 *   PDP_CLIENT_SECRET secret OAuth2 client_credentials (option 2)
 *   PDP_TOKEN_URL     endpoint de jeton OAuth2 (facultatif — défaut déduit)
 *   PDP_ENV           "sandbox" (défaut) ou "production"
 *   PDP_EMIT_PATH / PDP_STATUS_PATH / PDP_INBOX_PATH  chemins surchargeables
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

const env = () => (process.env.PDP_ENV === 'production' ? 'production' : 'sandbox');

// ── Adaptateur Iopole (Plateforme Agréée DGFiP n°0018) ──────────────────────
// Spécificités de l'API Iopole : émission en multipart sur /v1/invoice (le XML
// dans la propriété `file`), appels asynchrones, Bearer token (OAuth2
// client_credentials ou jeton statique). URLs par défaut : pré-production
// (sandbox) et production. Chemins surchargeables par env le temps de valider
// les derniers détails en sandbox.
const IOPOLE = {
  baseUrl: {
    sandbox: 'https://api.ppd.iopole.fr',
    production: 'https://api.iopole.fr'
  },
  emitPath: '/v1/invoice',
  statusPath: '/v1/invoice/:id',
  inboxPath: '/v1/invoice?direction=INBOUND'
};

const isIopole = () => (process.env.PDP_PROVIDER || '').trim().toLowerCase() === 'iopole';

// URL racine effective : explicite si fournie, sinon défaut de l'adaptateur.
const baseUrl = () => {
  if (process.env.PDP_BASE_URL) return process.env.PDP_BASE_URL.replace(/\/+$/, '');
  if (isIopole()) return IOPOLE.baseUrl[env()];
  return null;
};

// Authentification possible par clé statique OU par couple OAuth2 client_credentials.
const hasCredentials = () =>
  Boolean(process.env.PDP_API_KEY || (process.env.PDP_CLIENT_ID && process.env.PDP_CLIENT_SECRET));

const isConfigured = () => Boolean(baseUrl() && hasCredentials());

const providerName = () => process.env.PDP_PROVIDER || (isConfigured() ? 'pdp' : null);

// ── Jeton OAuth2 (client_credentials) avec cache mémoire ────────────────────
let tokenCache = { value: null, expiresAt: 0 };

const getToken = async () => {
  const { PDP_CLIENT_ID, PDP_CLIENT_SECRET } = process.env;
  // Mode clé statique : rien à négocier.
  if (!PDP_CLIENT_ID || !PDP_CLIENT_SECRET) return process.env.PDP_API_KEY || null;
  // Jeton encore valide (marge de 30 s) : on le réutilise.
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 30000) return tokenCache.value;

  const tokenUrl = process.env.PDP_TOKEN_URL || `${baseUrl()}/v1/auth/token`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: PDP_CLIENT_ID,
        client_secret: PDP_CLIENT_SECRET
      }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.access_token) {
      logger.warn('PDP : échec de récupération du jeton OAuth2', { status: res.status });
      return null;
    }
    tokenCache = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 300) * 1000
    };
    return tokenCache.value;
  } catch (err) {
    logger.warn('PDP : jeton OAuth2 injoignable', { error: err.message });
    return null;
  } finally {
    clearTimeout(timer);
  }
};

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
// `body` : objet (JSON) ou FormData (multipart — le Content-Type est alors géré
// automatiquement par fetch, frontière comprise).
const call = async (path, { method = 'GET', body } = {}) => {
  const token = await getToken();
  if (!token) return { ok: false, status: 401, error: 'Authentification PDP impossible (jeton indisponible)' };
  const url = baseUrl() + (path.startsWith('/') ? path : '/' + path);
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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
  let path;
  let body;
  if (isIopole()) {
    // Iopole : émission multipart, le XML CII dans la propriété `file`.
    // L'appel est asynchrone côté Iopole — la réponse fournit l'identifiant de
    // suivi, le cycle de vie s'interroge (ou arrive par webhook) ensuite.
    path = process.env.PDP_EMIT_PATH || IOPOLE.emitPath;
    body = new FormData();
    body.append('file', new Blob([xml], { type: 'application/xml' }), `factur-x_${invoice.numero}.xml`);
    body.append('type', 'CII');
  } else {
    // Contrat générique : JSON avec le XML encodé en base64 + métadonnées de routage.
    path = process.env.PDP_EMIT_PATH || '/invoices';
    body = {
      format: 'factur-x',
      profile: 'en16931',
      number: invoice.numero,
      content_base64: Buffer.from(xml, 'utf8').toString('base64'),
      seller: { name: company?.nom, siret: company?.siret, vat: company?.tvaIntra },
      buyer: { name: invoice.client?.nom, siret: invoice.client?.siret, email: invoice.client?.email },
      total_incl_tax: Number(invoice.montantTTC) || 0,
      currency: 'EUR'
    };
  }
  const r = await call(path, { method: 'POST', body });
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
  const tpl = process.env.PDP_STATUS_PATH || (isIopole() ? IOPOLE.statusPath : '/invoices/:id/status');
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
  const path = process.env.PDP_INBOX_PATH || (isIopole() ? IOPOLE.inboxPath : '/invoices/inbound');
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

// État de la configuration (pour l'UI / diagnostic), sans jamais exposer les secrets.
const infos = () => ({
  configured: isConfigured(),
  provider: providerName(),
  env: isConfigured() ? env() : null,
  baseUrl: isConfigured() ? baseUrl() : null,
  authMode: process.env.PDP_CLIENT_ID ? 'oauth2_client_credentials' : (process.env.PDP_API_KEY ? 'api_key' : null),
  statuts: STATUTS_CYCLE
});

module.exports = {
  STATUTS_CYCLE,
  isConfigured,
  isIopole,
  providerName,
  normaliserStatut,
  emettreFacture,
  statutFacture,
  recevoirFactures,
  infos
};
