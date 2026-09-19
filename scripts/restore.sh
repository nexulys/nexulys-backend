#!/usr/bin/env bash
#
# Restauration d'une sauvegarde Novexa.
#
# Usage :
#   npm run restore -- backups/novexa-20260101T030000Z.archive.enc
#   RESTORE_URI="mongodb://localhost:27017/novexa_test" npm run restore -- <archive>
#
# Par défaut la restauration vise RESTORE_URI, et JAMAIS MONGODB_URI : écraser la base
# de production doit être un geste explicite, pas la valeur par défaut d'un script.
#
set -Eeuo pipefail

log()    { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
erreur() { printf '[%s] ERREUR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

[ -f .env ] && set -a && . ./.env && set +a || true

ARCHIVE="${1:-}"
[ -n "$ARCHIVE" ]   || erreur "Usage : npm run restore -- <chemin de l'archive .enc>"
[ -f "$ARCHIVE" ]   || erreur "Archive introuvable : $ARCHIVE"
[ -n "${BACKUP_PASSPHRASE:-}" ] || erreur "BACKUP_PASSPHRASE non définie."

CIBLE="${RESTORE_URI:-}"
[ -n "$CIBLE" ] || erreur "RESTORE_URI non définie. Indiquez explicitement la base de destination (ne restaurez pas par défaut sur la production)."

command -v mongorestore >/dev/null || erreur "mongorestore introuvable (paquet mongodb-database-tools)."
command -v openssl      >/dev/null || erreur "openssl introuvable."

if [ -f "${ARCHIVE}.sha256" ]; then
  log "Vérification de l'empreinte…"
  ( cd "$(dirname "$ARCHIVE")" && { sha256sum -c "$(basename "$ARCHIVE").sha256" \
      || shasum -a 256 -c "$(basename "$ARCHIVE").sha256"; } ) \
    || erreur "Empreinte invalide — archive corrompue ou altérée."
else
  log "AVERTISSEMENT: pas de fichier .sha256, intégrité non vérifiable."
fi

# Garde-fou : la production ne se restaure pas sans confirmation explicite.
if [ -n "${MONGODB_URI:-}" ] && [ "$CIBLE" = "$MONGODB_URI" ]; then
  if [ "${CONFIRMER_PRODUCTION:-}" != "oui" ]; then
    erreur "RESTORE_URI vise la base de production. Relancez avec CONFIRMER_PRODUCTION=oui si c'est bien l'intention."
  fi
  log "AVERTISSEMENT: restauration sur la base de PRODUCTION, confirmée par CONFIRMER_PRODUCTION=oui."
fi

TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT INT TERM

log "Déchiffrement…"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$ARCHIVE" -out "$TRAVAIL/dump.archive" \
  -pass env:BACKUP_PASSPHRASE || erreur "Déchiffrement échoué (mauvaise passphrase ?)."

log "Restauration vers la base cible…"
mongorestore --uri="$CIBLE" --archive="$TRAVAIL/dump.archive" --gzip --drop \
  || erreur "mongorestore a échoué."

log "Restauration terminée."
log "Pensez à vérifier que DATA_ENCRYPTION_KEY correspond bien aux données restaurées :"
log "sans la clé d'origine, les IBAN et numéros de sécurité sociale resteront illisibles."
