#!/usr/bin/env bash
#
# Vérification d'un déploiement, depuis l'extérieur.
#
# Ne teste pas la logique métier — les tests s'en chargent — mais ce qui ne peut
# se constater qu'en production : la configuration réellement chargée, les
# en-têtes servis, les gardes actifs.
#
# Usage :
#   npm run smoke -- https://api.novexa.fr
#   BASE_URL=https://api.novexa.fr npm run smoke
#
set -uo pipefail

BASE="${1:-${BASE_URL:-http://localhost:5000}}"
BASE="${BASE%/}"

VERT='\033[0;32m'; ROUGE='\033[0;31m'; JAUNE='\033[0;33m'; GRIS='\033[0;90m'; NC='\033[0m'
ECHECS=0; ALERTES=0

ok()     { printf "  ${VERT}✓${NC} %s\n" "$1"; }
echec()  { printf "  ${ROUGE}✗${NC} %s\n" "$1"; ECHECS=$((ECHECS+1)); }
alerte() { printf "  ${JAUNE}!${NC} %s\n" "$1"; ALERTES=$((ALERTES+1)); }
detail() { printf "      ${GRIS}%s${NC}\n" "$1"; }

code_http() { curl -s -o /dev/null -w '%{http_code}' -m 15 "$@"; }
entetes()   { curl -sI -m 15 "$@"; }

echo ""
echo "Vérification du déploiement — $BASE"
echo "════════════════════════════════════════════════════════════════"

# ── Disponibilité ──
printf "\nDisponibilité\n"
CODE=$(code_http "$BASE/api/health/live")
if [ "$CODE" = "200" ]; then ok "le service répond"; else echec "sonde de vie : HTTP $CODE"; fi

SANTE=$(curl -s -m 15 "$BASE/api/health" || echo '{}')
CODE=$(code_http "$BASE/api/health")
if [ "$CODE" = "200" ]; then
  ok "base de données connectée"
elif [ "$CODE" = "503" ]; then
  echec "base de données injoignable (503)"
  detail "le service tourne mais ne peut rien servir"
else
  echec "état de santé : HTTP $CODE"
fi

if echo "$SANTE" | grep -q '"environment":"production"'; then
  ok "environnement de production"
else
  alerte "NODE_ENV ne vaut pas production"
  detail "les gardes de production (MFA, refus du seed, Stripe strict) sont inactifs"
fi

# ── En-têtes de sécurité ──
printf "\nEn-têtes de sécurité\n"
H=$(entetes "$BASE/api/health/live")

verifier_entete() {
  if echo "$H" | grep -qi "^$1:"; then ok "$2"; else echec "$2 absent"; fi
}
verifier_entete "strict-transport-security" "HSTS"
verifier_entete "x-content-type-options"    "X-Content-Type-Options"
verifier_entete "referrer-policy"           "Referrer-Policy"

CSP=$(echo "$H" | grep -i "^content-security-policy:" || true)
if [ -z "$CSP" ]; then
  echec "Content-Security-Policy absente"
# `script-src ` avec l'espace : sans lui le motif matche aussi `script-src-attr`,
# qui autorise légitimement unsafe-inline pour les gestionnaires onclick existants
# sans rouvrir l'exécution de blocs <script> injectés.
elif echo "$CSP" | grep -qE "script-src [^;]*'unsafe-inline'"; then
  echec "CSP : script-src autorise 'unsafe-inline'"
  detail "une injection HTML permettrait d'exécuter du script"
else
  ok "CSP sans unsafe-inline sur script-src"
  if echo "$CSP" | grep -qE "script-src-attr [^;]*'unsafe-inline'"; then
    detail "script-src-attr autorise unsafe-inline (gestionnaires onclick) — attendu"
  fi
fi

if echo "$H" | grep -qi "^x-powered-by:"; then
  alerte "en-tête X-Powered-By exposé"
else
  ok "pas de divulgation de la pile technique"
fi

# ── Authentification ──
printf "\nAuthentification\n"
CODE=$(code_http "$BASE/api/comptabilite/factures")
if [ "$CODE" = "401" ]; then ok "route métier protégée (401 sans jeton)"; else echec "route métier accessible sans jeton : HTTP $CODE"; fi

CODE=$(code_http -X PUT "$BASE/api/equipe/000000000000000000000000" -H 'Content-Type: application/json' -d '{"role":"admin"}')
if [ "$CODE" = "401" ]; then ok "changement de rôle refusé sans authentification"; else echec "changement de rôle : HTTP $CODE au lieu de 401"; fi

# ── Gardes de production ──
printf "\nGardes de production\n"
CODE=$(code_http -X POST "$BASE/api/seed")
if [ "$CODE" = "404" ]; then
  ok "route de seed neutralisée"
elif [ "$CODE" = "401" ]; then
  echec "la route de seed répond 401 : elle existe encore"
  detail "en production elle doit renvoyer 404 — elle vide dix collections"
else
  echec "route de seed : HTTP $CODE"
fi

REP=$(curl -s -m 15 -X POST "$BASE/api/admin/login" -H 'Content-Type: application/json' -d '{"password":"test"}' || echo '{}')
if echo "$REP" | grep -q "ADMIN_TOTP_SECRET"; then
  echec "le back-office refuse de fonctionner : ADMIN_TOTP_SECRET manquant"
  detail "générez-le avec npm run admin:mfa"
elif echo "$REP" | grep -qi "non configuré"; then
  alerte "back-office non configuré (ADMIN_SECRET absent)"
else
  ok "back-office configuré"
fi

CONFIG_MFA=$(curl -s -m 15 "$BASE/api/admin/login-config" || echo '{}')
if echo "$CONFIG_MFA" | grep -q '"mfaRequis":true'; then
  ok "second facteur exigé sur le back-office"
elif echo "$CONFIG_MFA" | grep -q '"mfaRequis":false'; then
  echec "back-office sans second facteur"
fi

# ── Jetons d'accès public ──
printf "\nJetons d'accès public\n"
CODE=$(code_http "$BASE/api/portail/acces")
if [ "$CODE" = "401" ]; then ok "jeton exigé sur le portail client"; else echec "portail client : HTTP $CODE au lieu de 401"; fi

CODE=$(code_http "$BASE/api/portail/acces" -H "X-Access-Token: pas-un-jeton")
if [ "$CODE" = "401" ]; then ok "format de jeton validé avant toute requête en base"; else alerte "jeton malformé : HTTP $CODE"; fi

# ── CORS ──
printf "\nCORS\n"
ORIGINE_HOSTILE="https://exemple-attaquant.invalid"

# Sur un point soumis à l'allowlist : aucune origine arbitraire ne doit être reflétée.
H_CORS=$(curl -sI -m 15 -H "Origin: $ORIGINE_HOSTILE" "$BASE/api/health")
if echo "$H_CORS" | grep -qi "access-control-allow-origin: $ORIGINE_HOSTILE"; then
  echec "CORS reflète une origine arbitraire"
  detail "n'importe quel site pourrait lire les réponses authentifiées"
else
  ok "origine non autorisée rejetée"
fi

# La sonde de vie, elle, doit rester lisible partout : c'est ce qui permet à
# /diagnostic.html de distinguer « service arrêté » de « origine non autorisée ».
# Si elle se refermait, le diagnostic accuserait le serveur d'être arrêté alors
# qu'il tourne.
H_LIVE=$(curl -sI -m 15 -H "Origin: $ORIGINE_HOSTILE" "$BASE/api/health/live")
if echo "$H_LIVE" | grep -qi "access-control-allow-origin: \*"; then
  ok "sonde de vie lisible depuis toute origine (diagnostic client opérant)"
else
  echec "la sonde de vie n'est plus lisible hors origine autorisée"
  detail "/diagnostic.html ne pourra plus distinguer service arrêté et CORS mal réglé"
fi

# L'origine réellement servie aux clients doit figurer dans l'allowlist : c'est
# l'oubli de configuration qui rend la connexion impossible sans rien afficher.
if [ -n "${FRONTEND_ORIGIN:-}" ]; then
  H_FRONT=$(curl -sI -m 15 -H "Origin: $FRONTEND_ORIGIN" "$BASE/api/health")
  if echo "$H_FRONT" | grep -qi "access-control-allow-origin: $FRONTEND_ORIGIN"; then
    ok "origine du frontend autorisée ($FRONTEND_ORIGIN)"
  else
    echec "l'origine du frontend n'est pas autorisée : $FRONTEND_ORIGIN"
    detail "ajoutez-la à ALLOWED_ORIGINS, sinon aucune connexion n'est possible"
  fi
else
  alerte "FRONTEND_ORIGIN non fourni — autorisation du frontend non vérifiée"
  detail "FRONTEND_ORIGIN=https://votre-site npm run smoke -- $BASE"
fi

# ── Limitation de débit ──
printf "\nLimitation de débit\n"
VU_429=0
for _ in $(seq 1 15); do
  C=$(code_http -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"sonde@exemple.invalid","password":"x"}')
  [ "$C" = "429" ] && VU_429=1 && break
done
if [ "$VU_429" = "1" ]; then
  ok "anti-force-brute actif sur la connexion"
else
  alerte "aucun 429 après 15 tentatives"
  detail "vérifiez TRUST_PROXY_HOPS : mal réglé, les quotas deviennent collectifs"
fi

# ── Verdict ──
echo ""
echo "════════════════════════════════════════════════════════════════"
if [ "$ECHECS" -gt 0 ]; then
  printf "${ROUGE}%d contrôle(s) en échec${NC}, %d alerte(s).\n" "$ECHECS" "$ALERTES"
  printf "Envisagez un retour arrière : ${GRIS}bash scripts/rollback.sh${NC}\n\n"
  exit 1
fi
if [ "$ALERTES" -gt 0 ]; then
  printf "${JAUNE}%d alerte(s)${NC}, aucun échec.\n\n" "$ALERTES"
  exit 0
fi
printf "${VERT}Déploiement vérifié.${NC}\n\n"
exit 0
