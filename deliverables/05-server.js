/**
 * Novexa — serveur applicatif principal
 * Éditeur : Nexulys SAS
 *
 * Cible : Node.js 20+, Express 4, PostgreSQL 16 via Prisma, Anthropic Claude.
 *
 * ┌─ À LIRE AVANT DE DÉPLOYER ────────────────────────────────────────────────┐
 * │ Ce fichier est la référence de l'architecture cible (PostgreSQL/Prisma).  │
 * │ Le serveur en production est /server.js, sur MongoDB, durci et couvert    │
 * │ par 157 tests et une CI verte. Ne remplacez pas l'un par l'autre sans     │
 * │ migration des données : ce serveur suppose un schéma Prisma appliqué.     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Démarrage :
 *   npm i express helmet cors cookie-parser express-rate-limit morgan zod \
 *         jsonwebtoken bcryptjs @prisma/client @anthropic-ai/sdk
 *   npx prisma migrate deploy
 *   psql "$DATABASE_URL" -f prisma/rls.sql -f prisma/constraints.sql
 *   node deliverables/05-server.js
 */

'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk');

// ─────────────────────────────────────────────────────────────
// Configuration — échouer au démarrage plutôt qu'en production
// ─────────────────────────────────────────────────────────────

const REQUIS = ['DATABASE_URL', 'JWT_SECRET', 'DATA_ENCRYPTION_KEY', 'ANTHROPIC_API_KEY'];
const manquants = REQUIS.filter((cle) => !process.env[cle]);

if (manquants.length) {
  // Un secret absent découvert au premier appel client est un incident ; découvert
  // au démarrage, c'est un déploiement qui ne passe pas. On préfère le second.
  console.error(`FATAL — variables d'environnement manquantes : ${manquants.join(', ')}`);
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(process.env.DATA_ENCRYPTION_KEY)) {
  console.error('FATAL — DATA_ENCRYPTION_KEY doit faire 64 caractères hexadécimaux.');
  process.exit(1);
}

const CONFIG = {
  port: Number(process.env.PORT || 5000),
  env: process.env.NODE_ENV || 'development',
  production: process.env.NODE_ENV === 'production',
  origines: (process.env.ALLOWED_ORIGINS || 'http://localhost:5000')
    .split(',').map((o) => o.trim()).filter(Boolean),
  proxies: Number(process.env.TRUST_PROXY_HOPS || 1),
  jwtSecret: process.env.JWT_SECRET,
  dureeSession: '7d',
};

const prisma = new PrismaClient({
  log: CONFIG.production ? ['warn', 'error'] : ['warn', 'error'],
});

const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY

const app = express();

// ─────────────────────────────────────────────────────────────
// Journalisation
// ─────────────────────────────────────────────────────────────

const journal = {
  info: (msg, meta = {}) => console.log(JSON.stringify({ niveau: 'info', msg, ...meta, ts: new Date().toISOString() })),
  warn: (msg, meta = {}) => console.warn(JSON.stringify({ niveau: 'warn', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ niveau: 'error', msg, ...meta, ts: new Date().toISOString() })),
};

// ─────────────────────────────────────────────────────────────
// Chiffrement applicatif (IBAN, NIR)
// ─────────────────────────────────────────────────────────────

const PREFIXE_CHIFFRE = 'enc:v1:';
const CLE = Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'hex');

/**
 * AES-256-GCM : chiffrement authentifié. Une altération du stockage est détectée
 * au déchiffrement, au lieu de produire silencieusement une valeur fausse — ce qui,
 * sur un IBAN de virement de paie, enverrait l'argent au mauvais endroit.
 */
function chiffrer(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return valeur;
  const texte = String(valeur);
  if (texte.startsWith(PREFIXE_CHIFFRE)) return texte; // idempotent

  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', CLE, iv);
  const donnees = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return PREFIXE_CHIFFRE + Buffer.concat([iv, c.getAuthTag(), donnees]).toString('base64');
}

function dechiffrer(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return valeur;
  const texte = String(valeur);
  if (!texte.startsWith(PREFIXE_CHIFFRE)) return texte;

  try {
    const brut = Buffer.from(texte.slice(PREFIXE_CHIFFRE.length), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', CLE, brut.subarray(0, 12));
    d.setAuthTag(brut.subarray(12, 28));
    return d.update(brut.subarray(28), undefined, 'utf8') + d.final('utf8');
  } catch (err) {
    journal.error('Échec de déchiffrement', { erreur: err.message });
    return null; // ne jamais renvoyer une valeur douteuse
  }
}

// ─────────────────────────────────────────────────────────────
// Sécurité HTTP
// ─────────────────────────────────────────────────────────────

// Sans ceci, req.ip vaut l'adresse du reverse-proxy pour toutes les requêtes : les
// quotas deviennent collectifs et l'anti-force-brute inopérant. Valeur numérique,
// jamais `true` — sinon X-Forwarded-For devient falsifiable par le client.
app.set('trust proxy', CONFIG.proxies);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Allowlist appliquée dans tous les environnements : `origin: true` reflète
// l'origine de l'appelant, ce qui, combiné aux cookies, laisse n'importe quel site
// lire les réponses authentifiées d'un utilisateur connecté.
app.use(cors({
  origin: (origine, callback) => {
    if (!origine) return callback(null, true); // appels serveur à serveur, curl
    return callback(null, CONFIG.origines.includes(origine));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token'],
}));

app.use(cookieParser());

// Le webhook Stripe exige le corps brut pour vérifier sa signature.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(morgan(CONFIG.production ? 'combined' : 'dev', {
  stream: { write: (m) => journal.info(m.trim()) },
}));

// ─────────────────────────────────────────────────────────────
// Protection CSRF par vérification d'origine
// ─────────────────────────────────────────────────────────────

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Le cookie de session est envoyé automatiquement par le navigateur, y compris sur
 * une requête déclenchée par un site tiers. On ne contrôle que les requêtes
 * mutantes réellement authentifiées par cookie : un appel porteur d'un Bearer token
 * n'est pas exposé, le navigateur ne l'attachant pas tout seul.
 */
app.use('/api', (req, res, next) => {
  if (METHODES_SURES.has(req.method)) return next();
  const parCookie = Boolean(req.cookies?.novexa_token);
  const parBearer = req.headers.authorization?.startsWith('Bearer ');
  if (!parCookie || parBearer) return next();

  const origine = req.headers.origin;
  if (origine) {
    if (CONFIG.origines.includes(origine)) return next();
    return res.status(403).json({ succes: false, message: 'Origine non autorisée.' });
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      if (CONFIG.origines.includes(new URL(referer).origin)) return next();
    } catch { /* referer illisible : traité comme absent */ }
  }
  return res.status(403).json({ succes: false, message: 'Origine manquante.' });
});

// ─────────────────────────────────────────────────────────────
// Limitation de débit
// ─────────────────────────────────────────────────────────────

// Neutralisée sous test : la suite partage un compteur mémoire et dépasserait le
// quota d'authentification avant d'avoir fini de s'exécuter.
const horsTests = () => CONFIG.env === 'test' && process.env.TEST_RATE_LIMIT !== 'true';

const limiteur = (fenetreMs, max, message, options = {}) => rateLimit({
  skip: horsTests,
  windowMs: fenetreMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { succes: false, message },
  handler: (req, res, next, opts) => {
    journal.warn('Quota atteint', { ip: req.ip, methode: req.method, url: req.originalUrl });
    res.status(429).json(opts.message);
  },
  ...options,
});

const quotaGlobal = limiteur(60_000, 300, 'Trop de requêtes. Réessayez dans une minute.');
const quotaAuth = limiteur(15 * 60_000, 10, 'Trop de tentatives. Réessayez dans quinze minutes.', { skipSuccessfulRequests: true });
const quotaIa = limiteur(60_000, 30, "Limite d'analyses atteinte. Réessayez dans une minute.");

app.use('/api', quotaGlobal);

// ─────────────────────────────────────────────────────────────
// Authentification
// ─────────────────────────────────────────────────────────────

function signerJeton(utilisateur) {
  return jwt.sign(
    { sub: utilisateur.id, cid: utilisateur.companyId, role: utilisateur.role, tv: utilisateur.tokenVersion },
    CONFIG.jwtSecret,
    { expiresIn: CONFIG.dureeSession, issuer: 'novexa', audience: 'novexa-api' },
  );
}

async function authentifier(req, res, next) {
  try {
    const jeton = req.cookies?.novexa_token
      || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!jeton) return res.status(401).json({ succes: false, message: 'Authentification requise.' });

    const charge = jwt.verify(jeton, CONFIG.jwtSecret, { issuer: 'novexa', audience: 'novexa-api' });

    const utilisateur = await prisma.user.findUnique({
      where: { id: charge.sub },
      select: { id: true, companyId: true, role: true, actif: true, tokenVersion: true, email: true },
    });

    if (!utilisateur) return res.status(401).json({ succes: false, message: 'Session invalide.' });
    if (!utilisateur.actif) return res.status(403).json({ succes: false, message: 'Compte désactivé.' });

    // Un changement de mot de passe incrémente tokenVersion : les jetons émis avant
    // cessent d'être valides, sans quoi un attaquant conserverait l'accès sept jours.
    if (charge.tv !== utilisateur.tokenVersion) {
      return res.status(401).json({ succes: false, message: 'Session expirée, reconnectez-vous.' });
    }

    req.utilisateur = utilisateur;
    next();
  } catch {
    return res.status(401).json({ succes: false, message: 'Session invalide.' });
  }
}

const exigerRole = (...roles) => (req, res, next) => {
  if (!req.utilisateur) return res.status(401).json({ succes: false, message: 'Authentification requise.' });
  if (!roles.includes(req.utilisateur.role)) {
    return res.status(403).json({ succes: false, message: 'Droits insuffisants.' });
  }
  next();
};

/**
 * Ouvre une transaction en positionnant le tenant courant, ce dont dépendent les
 * politiques Row Level Security. SET LOCAL meurt avec la transaction : la valeur ne
 * peut pas fuiter vers la requête suivante servie par la même connexion du pool.
 */
function transactionTenant(companyId, travail) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.company_id = '${companyId}'`);
    return travail(tx);
  });
}

// ─────────────────────────────────────────────────────────────
// Contrôle d'abonnement
// ─────────────────────────────────────────────────────────────

const STATUTS_OUVRANT_DROIT = new Set(['ACTIF']);

/**
 * Lecture seule quand l'abonnement est inactif. Retenir les données exposerait à un
 * litige et contreviendrait au droit d'accès ; laisser écrire reviendrait à offrir
 * le service. Les lectures et l'export restent donc ouverts, les écritures non.
 */
async function exigerAbonnementActif(req, res, next) {
  if (METHODES_SURES.has(req.method)) return next();
  try {
    const abonnement = await prisma.subscription.findUnique({
      where: { companyId: req.utilisateur.companyId },
      select: { statut: true, essaiFinLe: true },
    });

    if (!abonnement) return next(); // comptes antérieurs à la mise en place du garde

    const actif = STATUTS_OUVRANT_DROIT.has(abonnement.statut)
      || (abonnement.statut === 'ESSAI' && (!abonnement.essaiFinLe || abonnement.essaiFinLe > new Date()));

    if (actif) return next();

    return res.status(402).json({
      succes: false,
      code: 'ABONNEMENT_INACTIF',
      message: "Votre abonnement n'est pas actif. Vos données restent consultables et exportables ; la création et la modification sont suspendues.",
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────
// Endpoint IA — extraction comptable structurée
// ─────────────────────────────────────────────────────────────

const MODELE = 'claude-opus-5';

// Schéma de sortie imposé au modèle. La réponse est contrainte par l'API, puis
// revalidée ici : on ne fait jamais confiance à une sortie de modèle pour écrire en
// base, fût-elle déclarée conforme.
const SCHEMA_FACTURE = {
  type: 'object',
  properties: {
    fournisseur: { type: 'string', description: 'Raison sociale du fournisseur' },
    siret: { type: ['string', 'null'], description: 'SIRET à 14 chiffres, null si absent' },
    numeroFacture: { type: ['string', 'null'] },
    dateEmission: { type: ['string', 'null'], description: 'Format AAAA-MM-JJ' },
    dateEcheance: { type: ['string', 'null'], description: 'Format AAAA-MM-JJ' },
    montantHT: { type: 'number' },
    montantTVA: { type: 'number' },
    montantTTC: { type: 'number' },
    tauxTVA: { type: ['number', 'null'], description: '20, 10, 5.5, 2.1 ou 0' },
    devise: { type: 'string', description: 'Code ISO, EUR par défaut' },
    compteComptableSuggere: { type: 'string', description: 'Compte du PCG français, ex. 606100' },
    categorie: {
      type: 'string',
      enum: ['fournitures', 'services', 'transport', 'restauration', 'logiciel',
             'marketing', 'loyer', 'honoraires', 'energie', 'assurance', 'autre'],
    },
    anomalies: { type: 'array', items: { type: 'string' } },
    confiance: { type: 'number', description: 'Entre 0 et 1' },
  },
  required: ['fournisseur', 'montantHT', 'montantTVA', 'montantTTC', 'devise',
             'compteComptableSuggere', 'categorie', 'anomalies', 'confiance'],
  additionalProperties: false,
};

const zFacture = z.object({
  fournisseur: z.string().min(1),
  siret: z.string().nullable(),
  numeroFacture: z.string().nullable(),
  dateEmission: z.string().nullable(),
  dateEcheance: z.string().nullable(),
  montantHT: z.number(),
  montantTVA: z.number(),
  montantTTC: z.number(),
  tauxTVA: z.number().nullable(),
  devise: z.string(),
  compteComptableSuggere: z.string(),
  categorie: z.string(),
  anomalies: z.array(z.string()),
  confiance: z.number().min(0).max(1),
});

const INSTRUCTION = `Tu assistes des comptables français sur la saisie de factures fournisseurs.

Extrais les informations de la pièce fournie et propose une imputation au plan comptable général français.

Règles :
- N'invente jamais une valeur absente : utilise null.
- Les montants sont des nombres, sans symbole ni séparateur de milliers.
- Vérifie que HT + TVA = TTC ; si l'égalité est fausse, signale-le dans anomalies sans corriger les montants lus.
- Signale dans anomalies : un taux de TVA incohérent avec la nature de la prestation, une date d'échéance antérieure à l'émission, un SIRET mal formé, une mention manquante obligatoire.
- confiance reflète ta certitude réelle sur l'ensemble de l'extraction. Sois sévère : une pièce floue, partielle ou ambiguë doit descendre sous 0,7.
- Tu proposes une imputation, tu ne décides pas. Un humain valide.`;

const corpsAnalyse = z.object({
  documentId: z.string().uuid().optional(),
  texte: z.string().min(20).max(60_000).optional(),
  imageBase64: z.string().max(8_000_000).optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional(),
}).refine((d) => d.texte || d.imageBase64, {
  message: 'Fournissez soit texte, soit imageBase64.',
});

app.post('/api/ia/factures/analyser',
  authentifier,
  exigerAbonnementActif,
  exigerRole('PROPRIETAIRE', 'DAF', 'COMPTABLE'),
  quotaIa,
  async (req, res, next) => {
    const debut = Date.now();
    let job;

    try {
      const corps = corpsAnalyse.parse(req.body);

      job = await prisma.aiJob.create({
        data: {
          companyId: req.utilisateur.companyId,
          demandeParId: req.utilisateur.id,
          documentId: corps.documentId ?? null,
          tache: 'EXTRACTION_FACTURE',
          modele: MODELE,
          statut: 'EN_COURS',
          demarreLe: new Date(),
        },
      });

      const contenu = [];
      if (corps.imageBase64) {
        contenu.push(corps.mimeType === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: corps.imageBase64 } }
          : { type: 'image', source: { type: 'base64', media_type: corps.mimeType || 'image/jpeg', data: corps.imageBase64 } });
      }
      if (corps.texte) contenu.push({ type: 'text', text: corps.texte });
      contenu.push({ type: 'text', text: 'Extrais les informations de cette facture.' });

      // Streaming : une pièce longue avec raisonnement peut dépasser le délai d'une
      // requête classique. On récupère le message final une fois le flux terminé.
      const flux = anthropic.messages.stream({
        model: MODELE,
        max_tokens: 4096,
        system: INSTRUCTION,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium', // extraction cadrée : l'effort élevé n'apporte rien ici
          format: { type: 'json_schema', schema: SCHEMA_FACTURE },
        },
        messages: [{ role: 'user', content: contenu }],
      });

      const reponse = await flux.finalMessage();

      if (reponse.stop_reason === 'refusal') {
        await prisma.aiJob.update({
          where: { id: job.id },
          data: { statut: 'ECHEC', erreur: 'Requête déclinée par le fournisseur', termineLe: new Date() },
        });
        return res.status(422).json({ succes: false, message: "L'analyse a été refusée pour ce document." });
      }

      const bloc = reponse.content.find((b) => b.type === 'text');
      if (!bloc) throw new Error('Réponse sans contenu exploitable');

      const extrait = zFacture.parse(JSON.parse(bloc.text));

      // Contrôle arithmétique côté serveur : le modèle peut annoncer des montants
      // cohérents à tort. La vérification ne coûte rien et évite une écriture fausse.
      const ecart = Math.abs(extrait.montantTTC - (extrait.montantHT + extrait.montantTVA));
      if (ecart >= 0.01 && !extrait.anomalies.some((a) => /ht|tva|ttc|total/i.test(a))) {
        extrait.anomalies.push(`Incohérence arithmétique : HT + TVA ≠ TTC (écart de ${ecart.toFixed(2)} €).`);
      }

      const SEUIL_REVUE = 0.7;
      const revueRequise = extrait.confiance < SEUIL_REVUE || extrait.anomalies.length > 0;

      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          statut: revueRequise ? 'REVUE_HUMAINE' : 'REUSSI',
          resultat: extrait,
          confiance: extrait.confiance,
          tokensEntree: reponse.usage.input_tokens,
          tokensSortie: reponse.usage.output_tokens,
          coutMicroEuros: Math.round(
            (reponse.usage.input_tokens * 5 + reponse.usage.output_tokens * 25) / 1_000_000 * 1_000_000,
          ),
          termineLe: new Date(),
        },
      });

      await prisma.usageCounter.upsert({
        where: {
          companyId_periode_metrique: {
            companyId: req.utilisateur.companyId,
            periode: new Date().toISOString().slice(0, 7),
            metrique: 'DOCUMENTS_ANALYSES',
          },
        },
        create: {
          companyId: req.utilisateur.companyId,
          periode: new Date().toISOString().slice(0, 7),
          metrique: 'DOCUMENTS_ANALYSES',
          valeur: 1,
        },
        update: { valeur: { increment: 1 } },
      });

      return res.json({
        succes: true,
        donnees: {
          jobId: job.id,
          extraction: extrait,
          // Aucune écriture n'est créée ici : la proposition attend une validation
          // humaine, conformément à ce qui est annoncé aux clients.
          revueRequise,
          ecritureCreee: false,
          dureeMs: Date.now() - debut,
        },
      });
    } catch (err) {
      if (job) {
        await prisma.aiJob.update({
          where: { id: job.id },
          data: { statut: 'ECHEC', erreur: String(err.message).slice(0, 500), termineLe: new Date() },
        }).catch(() => {});
      }

      if (err instanceof z.ZodError) {
        return res.status(400).json({ succes: false, message: 'Requête invalide.', details: err.issues });
      }
      if (err instanceof Anthropic.RateLimitError) {
        return res.status(503).json({ succes: false, message: 'Service d\'analyse saturé. Réessayez dans quelques instants.' });
      }
      if (err instanceof Anthropic.AuthenticationError) {
        journal.error('Clé API Anthropic invalide');
        return res.status(503).json({ succes: false, message: "Service d'analyse indisponible." });
      }
      if (err instanceof Anthropic.APIError) {
        journal.error('Erreur fournisseur IA', { statut: err.status, message: err.message });
        return res.status(503).json({ succes: false, message: "Service d'analyse indisponible." });
      }
      return next(err);
    }
  });

// Consultation d'une analyse, cloisonnée par tenant.
app.get('/api/ia/jobs/:id', authentifier, async (req, res, next) => {
  try {
    const job = await prisma.aiJob.findFirst({
      where: { id: req.params.id, companyId: req.utilisateur.companyId },
    });
    if (!job) return res.status(404).json({ succes: false, message: 'Analyse introuvable.' });
    return res.json({ succes: true, donnees: job });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// Authentification applicative
// ─────────────────────────────────────────────────────────────

const bcrypt = require('bcryptjs');

const corpsConnexion = z.object({
  email: z.string().email().max(255),
  motDePasse: z.string().min(1).max(200),
});

app.post('/api/auth/connexion', quotaAuth, async (req, res, next) => {
  try {
    const { email, motDePasse } = corpsConnexion.parse(req.body);

    const utilisateur = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, companyId: true, role: true, actif: true, tokenVersion: true, motDePasseHash: true, email: true, prenom: true, nom: true },
    });

    // Comparaison effectuée même sans utilisateur trouvé : sinon le temps de réponse
    // distingue « compte inexistant » de « mot de passe faux », ce qui permet
    // d'énumérer les comptes.
    const condensatFactice = '$2a$12$' + 'x'.repeat(53);
    const valide = await bcrypt.compare(motDePasse, utilisateur?.motDePasseHash || condensatFactice);

    if (!utilisateur || !valide) {
      return res.status(401).json({ succes: false, message: 'Identifiants invalides.' });
    }
    if (!utilisateur.actif) {
      return res.status(403).json({ succes: false, message: 'Compte désactivé. Contactez votre administrateur.' });
    }

    const jeton = signerJeton(utilisateur);

    res.cookie('novexa_token', jeton, {
      httpOnly: true,
      secure: CONFIG.production,
      sameSite: CONFIG.production ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await prisma.user.update({
      where: { id: utilisateur.id },
      data: { derniereConnexion: new Date() },
    });

    return res.json({
      succes: true,
      donnees: {
        jeton,
        utilisateur: {
          id: utilisateur.id,
          email: utilisateur.email,
          prenom: utilisateur.prenom,
          nom: utilisateur.nom,
          role: utilisateur.role,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ succes: false, message: 'Requête invalide.' });
    }
    return next(err);
  }
});

app.post('/api/auth/deconnexion', (req, res) => {
  res.clearCookie('novexa_token', {
    httpOnly: true,
    secure: CONFIG.production,
    sameSite: CONFIG.production ? 'none' : 'lax',
  });
  return res.json({ succes: true, message: 'Déconnecté.' });
});

app.get('/api/auth/moi', authentifier, async (req, res, next) => {
  try {
    const utilisateur = await prisma.user.findUnique({
      where: { id: req.utilisateur.id },
      // Sélection explicite : le condensat du mot de passe ne doit jamais sortir.
      select: {
        id: true, email: true, prenom: true, nom: true, role: true, mfaActive: true,
        company: { select: { id: true, nom: true, siret: true } },
      },
    });
    return res.json({ succes: true, donnees: utilisateur });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// Santé
// ─────────────────────────────────────────────────────────────

app.get('/api/sante', async (req, res) => {
  const debut = Date.now();
  let baseOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    baseOk = true;
  } catch (err) {
    journal.error('Sonde base de données en échec', { erreur: err.message });
  }

  return res.status(baseOk ? 200 : 503).json({
    succes: baseOk,
    service: 'Novexa API',
    version: process.env.APP_VERSION || '1.0.0',
    environnement: CONFIG.env,
    dureeVieSecondes: Math.floor(process.uptime()),
    latenceSondeMs: Date.now() - debut,
    dependances: {
      baseDeDonnees: baseOk ? 'disponible' : 'indisponible',
      ia: Boolean(process.env.ANTHROPIC_API_KEY),
      paiement: Boolean(process.env.STRIPE_SECRET_KEY),
    },
  });
});

app.get('/api/sante/vivant', (req, res) => res.json({ vivant: true }));

// ─────────────────────────────────────────────────────────────
// Gestion des erreurs
// ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ succes: false, message: 'Ressource introuvable.' });
});

app.use((err, req, res, _next) => {
  journal.error('Erreur non interceptée', { message: err.message, pile: err.stack });

  if (err.code === 'P2002') {
    return res.status(409).json({ succes: false, message: 'Cette ressource existe déjà.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ succes: false, message: 'Ressource introuvable.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ succes: false, message: 'Contenu trop volumineux.' });
  }

  // En production, le détail interne n'est jamais renvoyé au client : il renseigne
  // un attaquant sur la structure du système.
  return res.status(err.status || 500).json({
    succes: false,
    message: CONFIG.production ? 'Erreur interne.' : err.message,
  });
});

// ─────────────────────────────────────────────────────────────
// Démarrage et arrêt propre
// ─────────────────────────────────────────────────────────────

const serveur = app.listen(CONFIG.port, () => {
  journal.info('Novexa API démarrée', { port: CONFIG.port, environnement: CONFIG.env });
});

// Arrêt propre : on laisse les requêtes en vol se terminer avant de fermer le pool,
// sans quoi un déploiement coupe des transactions comptables en cours.
async function arreter(signal) {
  journal.info('Arrêt demandé', { signal });
  serveur.close(async () => {
    await prisma.$disconnect();
    journal.info('Arrêt terminé');
    process.exit(0);
  });
  setTimeout(() => {
    journal.error('Arrêt forcé après expiration du délai');
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => arreter('SIGTERM'));
process.on('SIGINT', () => arreter('SIGINT'));

process.on('unhandledRejection', (raison) => {
  journal.error('Promesse rejetée non gérée', { raison: String(raison) });
});

module.exports = app;
