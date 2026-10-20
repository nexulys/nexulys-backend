#!/usr/bin/env node
/**
 * Chiffre les données sensibles déjà présentes en base (IBAN, numéro de sécurité
 * sociale). Rejouable sans risque : une valeur déjà chiffrée est ignorée.
 *
 * Usage : npm run migrate:chiffrement [-- --dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { chiffrer, estChiffre, masquer } = require('../utils/chiffrement');

const SIMULATION = process.argv.includes('--dry-run');

if (!process.env.DATA_ENCRYPTION_KEY) {
  console.error('DATA_ENCRYPTION_KEY absente. Générez-la avec `npm run generate:key`, puis relancez.');
  process.exit(1);
}
if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.error('MONGODB_URI absente.');
  process.exit(1);
}

/**
 * On travaille sur la collection brute, sans passer par les modèles : leurs setters
 * chiffreraient déjà la valeur et masqueraient l'état réel des documents.
 */
const migrerCollection = async (nomCollection, champs) => {
  const col = mongoose.connection.collection(nomCollection);
  const resultats = { examines: 0, chiffres: 0, deja: 0, vides: 0 };

  const curseur = col.find({});
  while (await curseur.hasNext()) {
    const doc = await curseur.next();
    resultats.examines++;
    const maj = {};

    for (const champ of champs) {
      const valeur = doc[champ];
      if (valeur === null || valeur === undefined || valeur === '') { resultats.vides++; continue; }
      if (estChiffre(valeur)) { resultats.deja++; continue; }
      maj[champ] = chiffrer(valeur);
      resultats.chiffres++;
      console.log(`  ${nomCollection}.${champ} [${doc._id}] : ${masquer(valeur)} → chiffré`);
    }

    if (Object.keys(maj).length && !SIMULATION) {
      await col.updateOne({ _id: doc._id }, { $set: maj });
    }
  }
  return resultats;
};

/** Les IBAN des virements sont imbriqués dans un tableau de lignes. */
const migrerVirements = async () => {
  const col = mongoose.connection.collection('virements');
  const resultats = { examines: 0, chiffres: 0, deja: 0, vides: 0 };

  const curseur = col.find({});
  while (await curseur.hasNext()) {
    const doc = await curseur.next();
    resultats.examines++;
    if (!Array.isArray(doc.lignes) || !doc.lignes.length) continue;

    let modifie = false;
    const lignes = doc.lignes.map((l) => {
      if (!l || !l.iban) { resultats.vides++; return l; }
      if (estChiffre(l.iban)) { resultats.deja++; return l; }
      resultats.chiffres++;
      modifie = true;
      console.log(`  virements.lignes[].iban [${doc._id}] : ${masquer(l.iban)} → chiffré`);
      return { ...l, iban: chiffrer(l.iban) };
    });

    if (modifie && !SIMULATION) {
      await col.updateOne({ _id: doc._id }, { $set: { lignes } });
    }
  }
  return resultats;
};

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log(`\nConnecté. ${SIMULATION ? 'SIMULATION — aucune écriture.' : 'Migration réelle.'}\n`);

  const total = { examines: 0, chiffres: 0, deja: 0, vides: 0 };
  const cumuler = (r) => { for (const k of Object.keys(total)) total[k] += r[k] || 0; };

  console.log('employees (numeroSecu, iban)');
  cumuler(await migrerCollection('employees', ['numeroSecu', 'iban']));
  console.log('companies (iban)');
  cumuler(await migrerCollection('companies', ['iban']));
  console.log('virements (lignes[].iban)');
  cumuler(await migrerVirements());

  console.log(`
─────────────────────────────────────────────
Documents examinés : ${total.examines}
Valeurs chiffrées  : ${total.chiffres}
Déjà chiffrées     : ${total.deja}
Vides / absentes   : ${total.vides}
─────────────────────────────────────────────
${SIMULATION ? '\nSimulation terminée — relancez sans --dry-run pour appliquer.' : '\nMigration terminée.'}
`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Échec de la migration :', err.message);
  process.exit(1);
});
