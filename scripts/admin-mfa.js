#!/usr/bin/env node
/**
 * Génère le secret TOTP du back-office et l'URI d'enrôlement à scanner.
 * Usage : npm run admin:mfa
 */
const { genererSecret, uriEnrolement, verifierTotp } = require('../utils/totp');

const secret = genererSecret();
const compte = process.env.ADMIN_EMAIL || 'admin';
const uri = uriEnrolement(secret, compte);

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  Novexa — second facteur du back-office plateforme               ║
╚══════════════════════════════════════════════════════════════════╝

1. Ajoutez cette variable d'environnement (ne la committez jamais) :

   ADMIN_TOTP_SECRET=${secret}

2. Enrôlez votre application d'authentification (Google Authenticator,
   1Password, Authy…) avec l'une de ces deux méthodes :

   • saisie manuelle de la clé : ${secret}
   • ou scan du QR code généré depuis cette URI :

   ${uri}

   Pour afficher le QR dans un terminal, sans dépendance supplémentaire :
   qrencode -t ANSIUTF8 "${uri}"

3. Redémarrez le serveur. La connexion au panel exigera désormais le
   mot de passe ADMIN_SECRET ET un code à 6 chiffres.

Vérification : collez ci-dessous un code de votre application pour
confirmer que l'enrôlement fonctionne (Ctrl+C pour passer).
`);

process.stdin.setEncoding('utf8');
process.stdout.write('Code à 6 chiffres > ');
process.stdin.on('data', (saisie) => {
  const code = saisie.trim();
  if (!code) return process.stdout.write('Code à 6 chiffres > ');
  if (verifierTotp(secret, code)) {
    console.log('\n✓ Code valide — l\'enrôlement est correct.\n');
    process.exit(0);
  }
  console.log('✗ Code invalide. Vérifiez l\'heure du téléphone, puis réessayez.');
  process.stdout.write('Code à 6 chiffres > ');
});
