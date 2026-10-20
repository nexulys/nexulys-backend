#!/usr/bin/env bash
#
# Sauvegarde chiffrée de la base Novexa.
#
# Produit une archive mongodump compressée puis chiffrée (AES-256), vérifie son
# intégrité, applique une rétention et pousse éventuellement vers un stockage distant.
#
# Usage :
#   npm run backup                  # sauvegarde complète
#   BACKUP_DIR=/srv/backups npm run backup
#
# Variables :
#   MONGODB_URI          (requis)  chaîne de connexion
#   BACKUP_PASSPHRASE    (requis)  passphrase de chiffrement de l'archive
#   BACKUP_DIR           (déf. ./backups)
#   BACKUP_RETENTION_DAYS (déf. 30)
#   BACKUP_REMOTE        (option)  destination rclone/S3, ex. s3:novexa-backups
#
set -Eeuo pipefail

log()    { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
erreur() { printf '[%s] ERREUR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

[ -f .env ] && set -a && . ./.env && set +a || true

: "${MONGODB_URI:=${MONGO_URI:-}}"
[ -n "$MONGODB_URI" ]       || erreur "MONGODB_URI non définie."
[ -n "${BACKUP_PASSPHRASE:-}" ] || erreur "BACKUP_PASSPHRASE non définie — une sauvegarde de données de paie ne doit pas être stockée en clair."

command -v mongodump >/dev/null || erreur "mongodump introuvable (paquet mongodb-database-tools)."
command -v openssl   >/dev/null || erreur "openssl introuvable."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
HORODATAGE="$(date -u +%Y%m%dT%H%M%SZ)"
NOM="novexa-${HORODATAGE}"
TRAVAIL="$(mktemp -d)"
# Nettoyage systématique : un dump en clair ne doit jamais subsister sur le disque.
trap 'rm -rf "$TRAVAIL"' EXIT INT TERM

mkdir -p "$BACKUP_DIR"

log "Export de la base…"
mongodump --uri="$MONGODB_URI" --archive="$TRAVAIL/${NOM}.archive" --gzip --quiet \
  || erreur "mongodump a échoué."

TAILLE=$(stat -c%s "$TRAVAIL/${NOM}.archive" 2>/dev/null || stat -f%z "$TRAVAIL/${NOM}.archive")
[ "$TAILLE" -gt 1024 ] || erreur "Archive suspecte (${TAILLE} octets) — sauvegarde interrompue."
log "Export terminé (${TAILLE} octets)."

log "Chiffrement (AES-256)…"
# -pbkdf2 : dérivation de clé robuste ; sans lui, openssl utilise un schéma obsolète.
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$TRAVAIL/${NOM}.archive" \
  -out "$BACKUP_DIR/${NOM}.archive.enc" \
  -pass env:BACKUP_PASSPHRASE || erreur "Chiffrement échoué."

log "Vérification du déchiffrement…"
# Une sauvegarde qu'on ne sait pas relire n'est pas une sauvegarde : on le vérifie
# immédiatement plutôt que le jour de l'incident.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$BACKUP_DIR/${NOM}.archive.enc" \
  -pass env:BACKUP_PASSPHRASE 2>/dev/null | head -c 1024 > "$TRAVAIL/verif" \
  || erreur "L'archive chiffrée est illisible — sauvegarde invalide."
[ -s "$TRAVAIL/verif" ] || erreur "Le déchiffrement de contrôle n'a rien produit."

( cd "$BACKUP_DIR" && sha256sum "${NOM}.archive.enc" > "${NOM}.archive.enc.sha256" 2>/dev/null \
  || shasum -a 256 "${NOM}.archive.enc" > "${NOM}.archive.enc.sha256" )

log "Sauvegarde créée : $BACKUP_DIR/${NOM}.archive.enc"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  if command -v rclone >/dev/null; then
    log "Envoi vers $BACKUP_REMOTE…"
    rclone copy "$BACKUP_DIR/${NOM}.archive.enc" "$BACKUP_REMOTE/" \
      && rclone copy "$BACKUP_DIR/${NOM}.archive.enc.sha256" "$BACKUP_REMOTE/" \
      && log "Copie distante effectuée." \
      || erreur "Copie distante échouée — la sauvegarde locale reste disponible."
  else
    log "AVERTISSEMENT: BACKUP_REMOTE défini mais rclone est absent — copie distante ignorée."
  fi
else
  log "AVERTISSEMENT: aucune copie distante (BACKUP_REMOTE non défini). Une sauvegarde"
  log "               sur la même machine que la base ne protège pas d'une perte du serveur."
fi

log "Purge des sauvegardes de plus de ${RETENTION} jours…"
find "$BACKUP_DIR" -name 'novexa-*.archive.enc*' -type f -mtime "+${RETENTION}" -print -delete || true

NB=$(find "$BACKUP_DIR" -name 'novexa-*.archive.enc' -type f | wc -l | tr -d ' ')
log "Terminé. ${NB} sauvegarde(s) conservée(s)."
