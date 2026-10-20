#!/usr/bin/env node
/**
 * Génère la clé de chiffrement des données sensibles (IBAN, NIR).
 * Usage : npm run generate:key
 */
const crypto = require('crypto');

const cle = crypto.randomBytes(32).toString('hex');

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  Novexa — clé de chiffrement des données sensibles               ║
╚══════════════════════════════════════════════════════════════════╝

Ajoutez cette variable d'environnement (ne la committez jamais) :

   DATA_ENCRYPTION_KEY=${cle}

⚠ Conservez-la dans un gestionnaire de secrets, sauvegardée séparément
  de la base de données. Sans elle, les IBAN et numéros de sécurité
  sociale déjà chiffrés deviennent définitivement illisibles — et une
  sauvegarde qui contiendrait la clé à côté des données n'offrirait
  plus aucune protection.

Après l'avoir définie, chiffrez les données existantes :

   npm run migrate:chiffrement
`);
