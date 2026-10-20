#!/usr/bin/env bash
#
# Retour arrière après un déploiement.
#
# Revenir au commit précédent ne suffit pas toujours : si la migration de
# chiffrement a été appliquée, les IBAN et NIR sont chiffrés en base et l'ancienne
# version du code, qui les lit en clair, renverrait des valeurs inexploitables.
# Ce script pose la question avant d'agir plutôt qu'après.
#
# Usage :
#   bash scripts/rollback.sh                      # revient au commit précédent
#   bash scripts/rollback.sh <sha>                # revient à un commit précis
#   CONFIRMER=oui bash scripts/rollback.sh <sha>  # sans invite (usage automatisé)
#
set -Eeuo pipefail

VERT='\033[0;32m'; ROUGE='\033[0;31m'; JAUNE='\033[0;33m'; GRIS='\033[0;90m'; NC='\033[0m'
log()    { printf "${VERT}[✓]${NC} %s\n" "$1"; }
avert()  { printf "${JAUNE}[!]${NC} %s\n" "$1"; }
erreur() { printf "${ROUGE}[✗]${NC} %s\n" "$1" >&2; exit 1; }

[ -f .env ] && set -a && . ./.env && set +a || true

CIBLE="${1:-}"
ACTUEL=$(git rev-parse --short HEAD)

if [ -z "$CIBLE" ]; then
  CIBLE=$(git rev-parse --short HEAD~1)
  avert "Aucun commit indiqué : retour au précédent ($CIBLE)."
fi

git cat-file -e "${CIBLE}^{commit}" 2>/dev/null || erreur "Commit introuvable : $CIBLE"

echo ""
echo "Retour arrière"
echo "════════════════════════════════════════════════════════════════"
echo "  Actuel   : $ACTUEL  $(git log -1 --format=%s "$ACTUEL" | cut -c1-55)"
echo "  Cible    : $CIBLE  $(git log -1 --format=%s "$CIBLE" | cut -c1-55)"
echo ""

# ── Ce qu'un retour de code ne défait pas ──
IRREVERSIBLES=()

# La migration de chiffrement transforme les données, pas le code. Revenir en
# arrière sans rechiffrer laisse des valeurs illisibles pour l'ancienne version.
if git diff --name-only "$CIBLE" HEAD 2>/dev/null | grep -q "utils/chiffrement.js\|models/Employee.js"; then
  IRREVERSIBLES+=("Chiffrement des données sensibles : si npm run migrate:chiffrement a été lancé, les IBAN et NIR sont chiffrés en base. L'ancienne version les lira tels quels et affichera des valeurs inexploitables. Restaurez une sauvegarde antérieure à la migration.")
fi

# L'index TTL supprime des documents ; la suppression est définitive.
if git diff --name-only "$CIBLE" HEAD 2>/dev/null | grep -q "models/AuditLog.js"; then
  IRREVERSIBLES+=("Rétention du journal d'audit : l'index TTL a pu supprimer des entrées de plus de 365 jours. Elles ne reviendront pas avec le code.")
fi

# Les effacements RGPD sont irréversibles par construction.
if git diff --name-only "$CIBLE" HEAD 2>/dev/null | grep -q "services/rgpdService.js"; then
  IRREVERSIBLES+=("Effacement RGPD : si la purge a tourné, les données concernées sont définitivement supprimées. Un retour de code ne les recrée pas.")
fi

if [ ${#IRREVERSIBLES[@]} -gt 0 ]; then
  printf "${JAUNE}Effets de bord non annulés par ce retour${NC}\n\n"
  for i in "${IRREVERSIBLES[@]}"; do
    printf "  ${JAUNE}!${NC} %s\n\n" "$i"
  done
fi

DOSSIER_SAUV="${BACKUP_DIR:-./backups}"
DERNIERE=$(ls -t "$DOSSIER_SAUV"/novexa-*.archive.enc 2>/dev/null | head -1 || true)
if [ -n "$DERNIERE" ]; then
  printf "  ${GRIS}Sauvegarde la plus récente : %s${NC}\n" "$(basename "$DERNIERE")"
  printf "  ${GRIS}Restauration : RESTORE_URI=\"...\" npm run restore -- %s${NC}\n\n" "$DERNIERE"
else
  avert "Aucune sauvegarde trouvée dans $DOSSIER_SAUV — aucun filet si le retour se passe mal."
  echo ""
fi

if [ "${CONFIRMER:-}" != "oui" ]; then
  printf "Revenir au commit %s ? [oui/non] " "$CIBLE"
  read -r reponse
  [ "$reponse" = "oui" ] || { echo "Abandon."; exit 0; }
fi

# ── Exécution ──
# Le travail non commité est mis de côté plutôt que perdu : il peut contenir un
# correctif en cours d'écriture au moment de l'incident.
if [ -n "$(git status --porcelain)" ]; then
  MARQUE="rollback-$(date -u +%Y%m%dT%H%M%SZ)"
  git stash push -u -m "$MARQUE" >/dev/null
  log "Modifications non commitées mises de côté ($MARQUE)"
  printf "    ${GRIS}récupération : git stash list puis git stash pop${NC}\n"
fi

# Branche de secours : le retour reste lui-même réversible.
BRANCHE_SECOURS="secours/${ACTUEL}-$(date -u +%Y%m%d%H%M)"
git branch "$BRANCHE_SECOURS" "$ACTUEL" 2>/dev/null || true
log "État actuel conservé sur la branche $BRANCHE_SECOURS"

git checkout --quiet "$CIBLE"
log "Code ramené à $CIBLE"

if [ -f package-lock.json ]; then
  npm ci --omit=dev --silent && log "Dépendances réinstallées" || avert "npm ci a échoué — vérifiez avant de redémarrer"
fi

echo ""
log "Retour effectué."
echo ""
echo "  À faire maintenant :"
echo "   1. redémarrer le service (systemctl restart novexa, ou redéploiement de la plateforme) ;"
echo "   2. vérifier :  npm run smoke -- \$APP_URL ;"
echo "   3. si les données sont en cause, restaurer la sauvegarde ci-dessus."
echo ""
echo "  Pour revenir en avant :  git checkout $BRANCHE_SECOURS"
echo ""
