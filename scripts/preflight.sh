#!/usr/bin/env bash
#
# Contrôles avant bascule en production.
#
# À lancer depuis la machine de déploiement, avec l'environnement de production
# chargé. Ne modifie rien : il constate et refuse.
#
# Usage :
#   npm run preflight
#   SAUTER_PARC=1 npm run preflight    # si l'audit du parc a déjà été traité
#
set -uo pipefail

VERT='\033[0;32m'; ROUGE='\033[0;31m'; JAUNE='\033[0;33m'; GRIS='\033[0;90m'; NC='\033[0m'
ok()      { printf "  ${VERT}✓${NC} %s\n" "$1"; }
echec()   { printf "  ${ROUGE}✗${NC} %s\n" "$1"; ECHECS=$((ECHECS+1)); }
alerte()  { printf "  ${JAUNE}!${NC} %s\n" "$1"; ALERTES=$((ALERTES+1)); }
detail()  { printf "      ${GRIS}%s${NC}\n" "$1"; }
titre()   { printf "\n%s\n" "$1"; }

ECHECS=0
ALERTES=0

[ -f .env ] && set -a && . ./.env && set +a || true

echo ""
echo "Contrôles avant déploiement — Novexa"
echo "════════════════════════════════════════════════════════════════"

# ── 1. Outillage ──
titre "Outillage"
for outil in node npm git; do
  if command -v "$outil" >/dev/null 2>&1; then ok "$outil présent"; else echec "$outil absent"; fi
done
if command -v mongodump >/dev/null 2>&1; then
  ok "mongodump présent"
else
  alerte "mongodump absent — les sauvegardes ne pourront pas s'exécuter"
  detail "paquet mongodb-database-tools"
fi

NODE_MAJEUR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$NODE_MAJEUR" -ge 20 ]; then ok "Node.js $(node -v)"; else echec "Node.js 20+ requis (trouvé $(node -v 2>/dev/null || echo aucun))"; fi

# ── 2. Configuration ──
titre "Configuration"
if NODE_ENV=production node scripts/check-env.js >/tmp/preflight-env.log 2>&1; then
  ok "variables d'environnement complètes"
  if grep -q "Incohérences" /tmp/preflight-env.log; then
    alerte "incohérences signalées — voir npm run check-env"
  fi
else
  echec "configuration incomplète ou invalide"
  detail "détail : NODE_ENV=production npm run check-env"
fi

# ── 3. Séparation des secrets ──
# Une clé rangée à côté de ce qu'elle protège n'offre plus de protection.
titre "Séparation des secrets"
if [ -n "${DATA_ENCRYPTION_KEY:-}" ] && [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  if [ "$DATA_ENCRYPTION_KEY" = "$BACKUP_PASSPHRASE" ]; then
    echec "DATA_ENCRYPTION_KEY et BACKUP_PASSPHRASE sont identiques"
    detail "la passphrase protège l'archive, la clé protège les IBAN à l'intérieur"
  else
    ok "clé de chiffrement et passphrase de sauvegarde distinctes"
  fi
fi
if [ -n "${BACKUP_DIR:-}" ] && [ -f "$BACKUP_DIR/.env" ]; then
  echec "un fichier .env se trouve dans le répertoire de sauvegarde"
  detail "les secrets y voisineraient les données qu'ils protègent"
fi

# ── 4. Code et tests ──
titre "Code"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  alerte "modifications non commitées dans l'arbre de travail"
  detail "le déploiement ne correspondra pas à un commit identifiable"
else
  ok "arbre de travail propre ($(git rev-parse --short HEAD 2>/dev/null))"
fi

if npm test --silent >/tmp/preflight-tests.log 2>&1; then
  ok "tests unitaires au vert ($(grep -oE 'Tests: *[0-9]+ passed' /tmp/preflight-tests.log | head -1))"
else
  echec "tests unitaires en échec"
  detail "détail : npm test"
fi

if npm audit --omit=dev --audit-level=high >/dev/null 2>&1; then
  ok "aucune vulnérabilité haute dans les dépendances de production"
else
  echec "vulnérabilités de dépendances de niveau haut"
  detail "npm audit --omit=dev --audit-level=high"
fi

# ── 5. Sauvegarde préalable ──
# Un déploiement qui change le schéma sans sauvegarde fraîche n'est pas
# réversible : c'est la condition qui rend le retour arrière possible.
titre "Sauvegarde"
DOSSIER_SAUV="${BACKUP_DIR:-./backups}"
DERNIERE=$(ls -t "$DOSSIER_SAUV"/novexa-*.archive.enc 2>/dev/null | head -1 || true)
if [ -z "$DERNIERE" ]; then
  echec "aucune sauvegarde trouvée dans $DOSSIER_SAUV"
  detail "lancez npm run backup avant de déployer"
else
  AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$DERNIERE" 2>/dev/null || stat -f %m "$DERNIERE") ) / 3600 ))
  if [ "$AGE_H" -le 24 ]; then
    ok "sauvegarde de moins de 24 h ($(basename "$DERNIERE"), ${AGE_H} h)"
  else
    echec "la sauvegarde la plus récente a ${AGE_H} h"
    detail "relancez npm run backup : sans sauvegarde fraîche le déploiement est irréversible"
  fi
  if [ -f "${DERNIERE}.sha256" ]; then ok "empreinte présente"; else alerte "empreinte absente — intégrité non vérifiable"; fi
fi

# ── 6. Parc client ──
titre "Parc client"
if [ "${SAUTER_PARC:-0}" = "1" ]; then
  alerte "audit du parc ignoré (SAUTER_PARC=1)"
else
  node scripts/audit-parc.js >/tmp/preflight-parc.log 2>&1
  CODE_PARC=$?
  if [ "$CODE_PARC" -eq 0 ]; then
    ok "aucun compte ne perdra l'accès en écriture"
  elif [ "$CODE_PARC" -eq 2 ]; then
    NB=$(grep -oE 'LECTURE SEULE *: *[0-9]+' /tmp/preflight-parc.log | grep -oE '[0-9]+$' || echo '?')
    echec "$NB compte(s) basculeront en lecture seule"
    detail "détail : npm run audit:parc — décidez avant de déployer"
  else
    alerte "audit du parc impossible (base injoignable ?)"
  fi
fi

# ── 7. Webhook Stripe ──
titre "Facturation"
if [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  ok "secret de webhook configuré"
  detail "vérifiez que checkout.session.completed est bien souscrit, sinon aucun paiement n'activera d'abonnement"
else
  if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
    echec "STRIPE_WEBHOOK_SECRET absent alors que Stripe est configuré"
    detail "les paiements aboutiraient sans jamais ouvrir l'accès"
  else
    alerte "Stripe non configuré — aucune souscription possible"
  fi
fi

# ── Verdict ──
echo ""
echo "════════════════════════════════════════════════════════════════"
if [ "$ECHECS" -gt 0 ]; then
  printf "${ROUGE}%d contrôle(s) en échec${NC}, %d alerte(s). Déploiement déconseillé.\n\n" "$ECHECS" "$ALERTES"
  exit 1
fi
if [ "$ALERTES" -gt 0 ]; then
  printf "${JAUNE}%d alerte(s)${NC}, aucun échec bloquant. Relisez-les avant de continuer.\n\n" "$ALERTES"
  exit 0
fi
printf "${VERT}Tous les contrôles passent.${NC} Vous pouvez déployer.\n\n"
exit 0
