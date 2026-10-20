#!/usr/bin/env node
/**
 * Audit du parc client avant déploiement.
 *
 * Le gating d'abonnement bascule en lecture seule tout compte dont l'essai est
 * expiré ou l'abonnement inactif. Sur un parc existant, ce changement est visible
 * par les clients dès la mise en production : ce script dit exactement qui est
 * concerné, AVANT la bascule.
 *
 * Lecture seule : n'écrit rien en base.
 *
 * Usage :
 *   npm run audit:parc
 *   npm run audit:parc -- --json        # sortie exploitable par un script
 *   npm run audit:parc -- --csv > parc.csv
 */
require('dotenv').config();
const mongoose = require('mongoose');

const FORMAT_JSON = process.argv.includes('--json');
const FORMAT_CSV = process.argv.includes('--csv');
const SILENCIEUX = FORMAT_JSON || FORMAT_CSV;

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('MONGODB_URI absente.');
  process.exit(1);
}

const STATUTS_ACTIFS = ['actif', 'active'];
const STATUTS_ESSAI = ['essai', 'trial'];

const jours = (d) => Math.round((Date.now() - new Date(d).getTime()) / 86400000);

(async () => {
  await mongoose.connect(uri);

  // Collections brutes : l'audit doit refléter l'état réel du stockage, sans les
  // valeurs par défaut ni les getters que les modèles appliqueraient.
  const companies = mongoose.connection.collection('companies');
  const subscriptions = mongoose.connection.collection('subscriptions');
  const users = mongoose.connection.collection('users');

  const toutes = await companies.find({}).toArray();
  const abonnements = await subscriptions.find({}).toArray();
  const parCompany = new Map(abonnements.map((s) => [String(s.company), s]));

  const lignes = [];

  for (const c of toutes) {
    const sub = parCompany.get(String(c._id));
    const nbUsers = await users.countDocuments({ company: c._id });

    let etat;
    let motif = '';

    if (!sub) {
      // Toléré par le garde : les comptes sans abonnement ne sont pas bloqués.
      etat = 'SANS_ABONNEMENT';
      motif = 'aucun abonnement — écriture tolérée';
    } else if (STATUTS_ACTIFS.includes(sub.statut)) {
      etat = 'OK';
      motif = 'abonnement actif';
    } else if (STATUTS_ESSAI.includes(sub.statut)) {
      const fin = sub.trialEndsAt;
      if (!fin) {
        etat = 'OK';
        motif = 'essai sans date de fin — écriture tolérée';
      } else if (new Date(fin) > new Date()) {
        const restants = Math.ceil((new Date(fin) - Date.now()) / 86400000);
        etat = restants <= 7 ? 'ESSAI_BIENTOT_EXPIRE' : 'OK';
        motif = `essai en cours, ${restants} jour(s) restant(s)`;
      } else {
        etat = 'BASCULE_LECTURE_SEULE';
        motif = `essai expiré depuis ${jours(fin)} jour(s)`;
      }
    } else {
      etat = 'BASCULE_LECTURE_SEULE';
      motif = `abonnement ${sub.statut}`;
    }

    lignes.push({
      id: String(c._id),
      nom: c.nom || '(sans nom)',
      siret: c.siret || '',
      email: c.email || '',
      utilisateurs: nbUsers,
      plan: sub?.plan || '',
      statut: sub?.statut || '',
      finEssai: sub?.trialEndsAt ? new Date(sub.trialEndsAt).toISOString().slice(0, 10) : '',
      derniereActivite: c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 10) : '',
      etat,
      motif,
    });
  }

  lignes.sort((a, b) => a.etat.localeCompare(b.etat) || a.nom.localeCompare(b.nom));

  const parEtat = lignes.reduce((acc, l) => {
    (acc[l.etat] = acc[l.etat] || []).push(l);
    return acc;
  }, {});

  if (FORMAT_JSON) {
    console.log(JSON.stringify({
      genereLe: new Date().toISOString(),
      total: lignes.length,
      resume: Object.fromEntries(Object.entries(parEtat).map(([k, v]) => [k, v.length])),
      entreprises: lignes,
    }, null, 2));
  } else if (FORMAT_CSV) {
    const colonnes = ['id', 'nom', 'siret', 'email', 'utilisateurs', 'plan', 'statut', 'finEssai', 'derniereActivite', 'etat', 'motif'];
    console.log(colonnes.join(','));
    for (const l of lignes) {
      console.log(colonnes.map((c) => {
        const v = String(l[c] ?? '');
        // Une valeur commençant par =, +, - ou @ est interprétée comme formule
        // par un tableur : on la neutralise.
        const sur = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
        return `"${sur.replace(/"/g, '""')}"`;
      }).join(','));
    }
  } else {
    const bloque = parEtat.BASCULE_LECTURE_SEULE || [];
    const bientot = parEtat.ESSAI_BIENTOT_EXPIRE || [];

    console.log(`\nAudit du parc — ${lignes.length} entreprise(s)\n${'─'.repeat(70)}`);
    console.log(`  Abonnement actif ou essai en cours  : ${(parEtat.OK || []).length}`);
    console.log(`  Sans abonnement (écriture tolérée)  : ${(parEtat.SANS_ABONNEMENT || []).length}`);
    console.log(`  Essai expirant sous 7 jours         : ${bientot.length}`);
    console.log(`  \x1b[31mBasculeront en LECTURE SEULE        : ${bloque.length}\x1b[0m`);

    if (bloque.length) {
      console.log(`\n\x1b[31mCes comptes perdront l'écriture au déploiement\x1b[0m\n`);
      console.log('  ' + 'Entreprise'.padEnd(32) + 'Util.'.padEnd(7) + 'Statut'.padEnd(14) + 'Motif');
      console.log('  ' + '─'.repeat(90));
      for (const l of bloque) {
        console.log(`  ${l.nom.slice(0, 30).padEnd(32)}${String(l.utilisateurs).padEnd(7)}${(l.statut || '—').padEnd(14)}${l.motif}`);
      }
      const total = bloque.reduce((s, l) => s + l.utilisateurs, 0);
      console.log(`\n  ${bloque.length} entreprise(s), ${total} utilisateur(s) concerné(s).`);
      console.log('\n  Avant de déployer, choisissez explicitement :');
      console.log('   • prévenir ces clients et les laisser basculer ;');
      console.log('   • prolonger leur essai (mise à jour de trialEndsAt) ;');
      console.log('   • passer leur abonnement à « actif » si le paiement a été encaissé hors plateforme.');
      console.log('\n  Ne rien décider revient à choisir la première option, sans prévenir personne.');
    }

    if (bientot.length) {
      console.log(`\n\x1b[33mEssais expirant sous 7 jours\x1b[0m\n`);
      for (const l of bientot) {
        console.log(`  ${l.nom.slice(0, 30).padEnd(32)}${l.motif}`);
      }
    }

    if (!bloque.length && !bientot.length) {
      console.log('\n\x1b[32mAucun compte ne perdra l\'accès en écriture.\x1b[0m');
    }
    console.log('');
  }

  await mongoose.disconnect();
  // Code 2 quand des comptes basculent : permet d'interrompre un pipeline de
  // déploiement tant que la décision n'a pas été prise.
  process.exit((parEtat.BASCULE_LECTURE_SEULE || []).length ? 2 : 0);
})().catch(async (err) => {
  if (!SILENCIEUX) console.error(`Échec de l'audit : ${err.message}`);
  else console.error(JSON.stringify({ erreur: err.message }));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
