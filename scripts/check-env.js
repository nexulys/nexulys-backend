#!/usr/bin/env node
/**
 * Vérification de la configuration Novexa.
 *
 * Usage :
 *   npm run check-env                 # vérifie l'environnement courant
 *   NODE_ENV=production npm run check-env
 *
 * Sort en code 1 si une variable requise manque ou est mal formée, de sorte que
 * la commande puisse servir de garde dans un pipeline de déploiement.
 */
require('dotenv').config();

const PROD = process.env.NODE_ENV === 'production';

const vert = (s) => `\x1b[32m${s}\x1b[0m`;
const rouge = (s) => `\x1b[31m${s}\x1b[0m`;
const jaune = (s) => `\x1b[33m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;

const erreurs = [];
const avertissements = [];

/**
 * @param {object} regle
 * @param {string} regle.cle          nom de la variable
 * @param {boolean} regle.requis      bloquant si absent
 * @param {RegExp} [regle.format]     format attendu
 * @param {string} regle.role         à quoi elle sert
 * @param {string} [regle.remede]     comment l'obtenir
 * @param {string} [regle.degrade]    ce qui se passe sans elle (si non requise)
 */
const verifier = (regle) => {
  const valeur = process.env[regle.cle];

  if (!valeur) {
    if (regle.requis) {
      erreurs.push(`${regle.cle} — ${regle.role}${regle.remede ? `\n      → ${regle.remede}` : ''}`);
      console.log(`  ${rouge('✗')} ${regle.cle.padEnd(24)} ${gris('manquant — ' + regle.role)}`);
    } else {
      avertissements.push(`${regle.cle} — ${regle.degrade || regle.role}`);
      console.log(`  ${jaune('!')} ${regle.cle.padEnd(24)} ${gris(regle.degrade || 'non configuré')}`);
    }
    return;
  }

  if (regle.format && !regle.format.test(valeur)) {
    erreurs.push(`${regle.cle} — format invalide. ${regle.role}${regle.remede ? `\n      → ${regle.remede}` : ''}`);
    console.log(`  ${rouge('✗')} ${regle.cle.padEnd(24)} ${gris('format invalide')}`);
    return;
  }

  console.log(`  ${vert('✓')} ${regle.cle.padEnd(24)} ${gris(regle.role)}`);
};

console.log(`\nConfiguration Novexa — environnement : ${PROD ? 'production' : (process.env.NODE_ENV || 'development')}\n`);

// ── Socle : sans ces variables, le serveur refuse de démarrer ──
console.log('Socle');
verifier({
  cle: 'MONGODB_URI',
  requis: true,
  format: /^mongodb(\+srv)?:\/\/.+/,
  role: 'base de données',
  remede: 'chaîne de connexion fournie par votre hébergeur MongoDB',
});
verifier({
  cle: 'JWT_SECRET',
  requis: true,
  format: /^.{32,}$/,
  role: 'signature des sessions (32 caractères minimum)',
  remede: "node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
});
verifier({
  cle: 'DATA_ENCRYPTION_KEY',
  // Requise en production : le serveur s'arrête au démarrage sans elle, car les
  // IBAN et NIR déjà chiffrés deviendraient illisibles et les nouveaux seraient
  // réécrits en clair.
  requis: PROD,
  format: /^[0-9a-f]{64}$/i,
  role: 'chiffrement des IBAN et NIR (64 caractères hexadécimaux)',
  remede: 'npm run generate:key',
  degrade: 'données sensibles stockées en clair (toléré hors production)',
});

// ── Exposition réseau ──
console.log('\nExposition réseau');
verifier({
  cle: 'ALLOWED_ORIGINS',
  requis: PROD,
  role: 'origines autorisées (CORS et anti-CSRF)',
  remede: 'liste séparée par des virgules, ex. https://app.novexa.fr',
  degrade: 'repli sur localhost — le frontend sera bloqué',
});
verifier({
  cle: 'TRUST_PROXY_HOPS',
  requis: false,
  format: /^[0-9]+$/,
  role: 'nombre de proxies en frontal (défaut 1)',
  degrade: 'défaut 1 — correct derrière un seul nginx ou Render',
});
verifier({
  cle: 'APP_URL',
  requis: PROD,
  format: /^https?:\/\/.+/,
  role: 'URL publique (liens e-mail, retours Stripe)',
  degrade: 'liens e-mail pointant vers localhost',
});

// ── Back-office plateforme ──
console.log('\nBack-office plateforme');
verifier({
  cle: 'ADMIN_SECRET',
  requis: false,
  format: /^.{16,}$/,
  role: 'mot de passe du back-office (16 caractères minimum)',
  degrade: 'back-office désactivé (503)',
});
verifier({
  cle: 'ADMIN_TOTP_SECRET',
  // Exigé par le contrôleur dès que NODE_ENV vaut production : sans lui,
  // /api/admin/login répond 503 plutôt que d'accepter un facteur unique.
  requis: PROD && Boolean(process.env.ADMIN_SECRET),
  format: /^[A-Z2-7]{16,}$/,
  role: 'second facteur du back-office',
  remede: 'npm run admin:mfa',
  degrade: 'second facteur désactivé',
});
verifier({
  cle: 'ADMIN_EMAIL',
  requis: false,
  format: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  role: 'destinataire des notifications RGPD et administratives',
  degrade: 'repli sur admin@novexa.fr',
});

// ── Facturation ──
console.log('\nFacturation');
verifier({
  cle: 'STRIPE_SECRET_KEY',
  requis: PROD,
  format: /^(sk|rk)_(test|live)_.+/,
  role: 'encaissement des abonnements',
  remede: 'tableau de bord Stripe → Développeurs → Clés API',
  degrade: 'souscription impossible (503 en production)',
});
verifier({
  cle: 'STRIPE_WEBHOOK_SECRET',
  // Sans lui, aucun abonnement ne passe jamais à l'état actif : les paiements
  // aboutissent chez Stripe sans que l'accès soit ouvert.
  requis: PROD && Boolean(process.env.STRIPE_SECRET_KEY),
  format: /^whsec_.+/,
  role: 'vérification des webhooks — sans lui aucun paiement n\'active l\'abonnement',
  remede: 'Stripe → Développeurs → Webhooks, événements checkout.session.completed et invoice.payment_succeeded',
  degrade: 'webhooks ignorés',
});

// ── Tâches planifiées ──
console.log('\nTâches planifiées');
verifier({
  cle: 'CRON_SECRET',
  requis: false,
  format: /^.{24,}$/,
  role: 'protège /api/cron/* (24 caractères minimum)',
  degrade: 'relances, rapports et purge RGPD désactivés',
});
verifier({
  cle: 'BACKUP_PASSPHRASE',
  requis: false,
  format: /^.{16,}$/,
  role: 'chiffrement des sauvegardes',
  degrade: 'npm run backup refusera de s\'exécuter',
});
verifier({
  cle: 'AUDIT_RETENTION_DAYS',
  requis: false,
  format: /^[0-9]+$/,
  role: 'rétention du journal d\'audit (défaut 365)',
  degrade: 'défaut 365 jours',
});

// ── Services annexes ──
console.log('\nServices annexes');
for (const regle of [
  { cle: 'GROQ_API_KEY', role: 'fournisseur IA principal', degrade: 'IA en mode démo' },
  { cle: 'OPENAI_API_KEY', role: 'fournisseur IA de repli', degrade: 'pas de repli IA' },
  { cle: 'SMTP_HOST', role: 'envoi des e-mails', degrade: 'e-mails désactivés (relances, réinitialisation)' },
  { cle: 'SENTRY_DSN', role: 'supervision des erreurs', degrade: 'aucune remontée d\'erreur' },
  { cle: 'PDP_PROVIDER', role: 'facturation électronique', degrade: 'transmission PDP indisponible' },
]) {
  verifier({ ...regle, requis: false });
}

// ── Incohérences ──
const incoherences = [];

if (process.env.SEED_SECRET && PROD) {
  incoherences.push(
    'SEED_SECRET est défini en production. La route de seed y est refusée de toute façon, ' +
    'mais ce secret n\'a aucune raison d\'exister sur cet environnement : supprimez-le.',
  );
}
if (process.env.ADMIN_TOTP_SECRET && !process.env.ADMIN_SECRET) {
  incoherences.push('ADMIN_TOTP_SECRET est défini sans ADMIN_SECRET : le back-office reste inaccessible.');
}
if (process.env.STRIPE_SECRET_KEY?.includes('_live_') && !PROD) {
  incoherences.push('Une clé Stripe LIVE est utilisée hors production : risque d\'encaissement réel lors des tests.');
}
if (process.env.STRIPE_SECRET_KEY?.includes('_test_') && PROD) {
  incoherences.push('Une clé Stripe TEST est utilisée en production : aucun paiement ne sera réellement encaissé.');
}
if (Number(process.env.TRUST_PROXY_HOPS) > 3) {
  incoherences.push(
    `TRUST_PROXY_HOPS vaut ${process.env.TRUST_PROXY_HOPS}. Une valeur supérieure au nombre réel de ` +
    'proxies rend X-Forwarded-For falsifiable, donc le rate limiting contournable.',
  );
}
if (process.env.DATA_ENCRYPTION_KEY && process.env.DATA_ENCRYPTION_KEY === process.env.JWT_SECRET) {
  incoherences.push('DATA_ENCRYPTION_KEY et JWT_SECRET sont identiques : une fuite de l\'un compromet l\'autre.');
}
if (process.env.BACKUP_PASSPHRASE && process.env.BACKUP_PASSPHRASE === process.env.DATA_ENCRYPTION_KEY) {
  incoherences.push(
    'BACKUP_PASSPHRASE et DATA_ENCRYPTION_KEY sont identiques. La passphrase protège l\'archive, ' +
    'la clé protège les IBAN à l\'intérieur : un secret unique annule cette double protection.',
  );
}

// ── Restitution ──
console.log('\n' + '─'.repeat(70));

if (incoherences.length) {
  console.log(`\n${jaune('Incohérences de configuration')}\n`);
  incoherences.forEach((i) => console.log(`  ${jaune('!')} ${i}\n`));
}

if (avertissements.length) {
  console.log(`\n${jaune(`${avertissements.length} fonctionnalité(s) dégradée(s)`)}\n`);
  avertissements.forEach((a) => console.log(`  ${jaune('!')} ${a}`));
}

if (erreurs.length) {
  console.log(`\n${rouge(`${erreurs.length} variable(s) requise(s) manquante(s) ou invalide(s)`)}\n`);
  erreurs.forEach((e) => console.log(`  ${rouge('✗')} ${e}`));
  console.log(`\n${rouge('Le serveur ne démarrera pas dans cet état.')}\n`);
  process.exit(1);
}

console.log(`\n${vert('Configuration valide')} — le serveur peut démarrer.\n`);
process.exit(0);
