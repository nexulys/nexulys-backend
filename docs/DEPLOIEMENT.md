# Runbook de déploiement

Procédure pour la première mise en production après les changements de sécurité, de
facturation et de conformité. Les déploiements suivants n'exécutent que les phases 4 à 6.

Trois points de cette procédure sont **irréversibles** ou **visibles par vos clients**.
Ils sont signalés là où ils se présentent : ne les découvrez pas en les exécutant.

---

## Phase 0 — Ce qui change pour vos clients

À lire avant toute manipulation technique.

| Changement | Effet visible |
|---|---|
| Gating d'abonnement | Tout compte en essai expiré ou abonnement inactif **passe en lecture seule**. Consultation et export restent possibles, la création et la modification non. |
| Limites de plan | Un client dépassant son quota d'utilisateurs ou de salariés ne peut plus en ajouter. |
| Souscription | Le parcours passe par Stripe Checkout. Un abonnement n'est actif qu'après encaissement. |
| Liens portail et expert | Les anciens liens `?token=` continuent de fonctionner et se réécrivent tout seuls. |

**Décidez du sort des comptes concernés avant de déployer**, pas après leur premier
appel au support :

```bash
npm run audit:parc          # liste les comptes qui basculeront
npm run audit:parc -- --csv > parc-$(date +%F).csv
```

Trois options par compte concerné : prévenir et laisser basculer, prolonger l'essai
(`trialEndsAt`), ou passer l'abonnement à `actif` si le paiement a été encaissé hors
plateforme. Ne rien décider revient à choisir la première, sans prévenir personne.

---

## Phase 1 — Générer les secrets

Trois secrets nouveaux sont requis. **Ils doivent vivre dans trois emplacements
distincts, et séparés des sauvegardes.**

```bash
npm run generate:key     # DATA_ENCRYPTION_KEY — chiffrement des IBAN et NIR
npm run admin:mfa        # ADMIN_TOTP_SECRET — second facteur du back-office
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BACKUP_PASSPHRASE
```

`npm run admin:mfa` affiche l'URI d'enrôlement et attend un premier code : enrôlez
votre application d'authentification tout de suite, sans quoi vous découvrirez le
problème le jour où vous aurez besoin du back-office.

| Secret | Conséquence de sa perte |
|---|---|
| `DATA_ENCRYPTION_KEY` | **IBAN et NIR définitivement illisibles.** Aucune récupération possible. |
| `BACKUP_PASSPHRASE` | Toutes les sauvegardes chiffrées deviennent inexploitables. |
| `ADMIN_TOTP_SECRET` | Back-office inaccessible jusqu'à réenrôlement. |
| `JWT_SECRET` | Déconnexion générale, sans perte de données. |

> **Point de non-retour.** Une fois la phase 3 exécutée, changer
> `DATA_ENCRYPTION_KEY` sans rechiffrer rend les données illisibles. Sauvegardez-la
> dans votre gestionnaire de secrets **avant** de continuer.

---

## Phase 2 — Configurer l'environnement

Renseignez les variables sur votre hébergeur (`render.yaml` en liste les nouvelles),
puis vérifiez :

```bash
NODE_ENV=production npm run check-env
```

La commande sort en erreur si une variable requise manque ou est mal formée, et
signale les incohérences — clé Stripe de test en production, secrets identiques,
`TRUST_PROXY_HOPS` surévalué.

**Webhook Stripe.** Dans le tableau de bord Stripe → Développeurs → Webhooks, pointez
sur `https://votre-domaine/api/stripe/webhook` et souscrivez :

- `checkout.session.completed` — **nouveau, indispensable** : sans lui aucun paiement
  n'active d'abonnement, les encaissements aboutissent et l'accès reste fermé ;
- `invoice.payment_succeeded` — renouvellements ;
- `invoice.payment_failed` — suspension sur impayé ;
- `customer.subscription.deleted` — résiliation.

Reportez le secret de signature dans `STRIPE_WEBHOOK_SECRET`.

---

## Phase 3 — Sauvegarder, puis chiffrer les données existantes

**Dans cet ordre.** La migration transforme les données en place.

```bash
npm run backup                              # sauvegarde chiffrée et vérifiée
npm run migrate:chiffrement -- --dry-run    # simulation : rien n'est écrit
npm run migrate:chiffrement                 # application
```

La migration est rejouable sans risque : une valeur déjà chiffrée est ignorée. Les
valeurs en clair antérieures restent lisibles pendant la bascule, donc l'opération ne
nécessite pas d'interruption de service.

> **Point de non-retour.** Après cette phase, l'ancienne version du code lirait des
> valeurs chiffrées comme du texte et afficherait des IBAN inexploitables. Un retour
> arrière impose de restaurer la sauvegarde ci-dessus.

---

## Phase 4 — Contrôles avant bascule

```bash
npm run preflight
```

Vérifie l'outillage, la configuration, la séparation des secrets, la propreté de
l'arbre Git, les tests, les vulnérabilités de dépendances, la fraîcheur de la
sauvegarde, le parc client et le webhook Stripe. Sort en erreur si un contrôle
bloquant échoue.

---

## Phase 5 — Déployer

```bash
git push origin main        # ou la procédure de votre hébergeur
```

Attendez que la CI passe au vert avant de considérer le déploiement effectif. Le
pipeline exécute l'audit de dépendances, les tests unitaires, les tests d'intégration
contre une vraie base et le démarrage de l'image Docker.

---

## Phase 6 — Vérifier

```bash
npm run smoke -- https://votre-domaine
```

Contrôle ce qui ne se constate qu'en production : en-têtes de sécurité, CSP, routes
protégées, neutralisation de la route de seed, second facteur actif, rejet des
origines non autorisées, anti-force-brute.

Puis, manuellement :

- [ ] connexion à l'application avec un compte réel ;
- [ ] souscription complète avec une carte de test Stripe, et vérification que
      l'abonnement passe bien à `actif` **après** paiement ;
- [ ] ouverture d'un lien portail déjà distribué à un client (les anciens liens
      doivent continuer de fonctionner) ;
- [ ] affichage d'une fiche salarié portant un IBAN : la valeur doit s'afficher en
      clair, ce qui prouve que le déchiffrement fonctionne ;
- [ ] connexion au back-office avec mot de passe **et** code à usage unique.

---

## Phase 7 — Planifier les tâches récurrentes

Trois tâches doivent tourner. `render.yaml` les définit pour Render ; sur un serveur
classique, via la crontab de l'utilisateur applicatif :

```cron
# Relances de paiement — jours ouvrés
0 7 * * 1-5 curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/relances"

# Rapports mensuels — le 1er du mois
0 6 1 * *   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/rapports"

# Purge RGPD — quotidienne. Sans elle, les demandes d'effacement restent en attente
# indéfiniment et le droit à l'effacement redevient une promesse non tenue.
30 3 * * *  curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/purge-rgpd"

# Sauvegarde quotidienne
0 3 * * *   cd /srv/novexa && /usr/bin/npm run backup >> /var/log/novexa-backup.log 2>&1
```

Le secret passe en en-tête, jamais en query string où il serait journalisé en clair.

Ne faites pas exécuter la sauvegarde par un service externe : cela lui donnerait un
accès direct à la base de production.

---

## Phase 8 — Vérifier une restauration

**À faire dans la semaine qui suit, pas « un jour ».** Une sauvegarde jamais restaurée
est une hypothèse.

```bash
RESTORE_URI="mongodb://localhost:27017/novexa_controle" \
  npm run restore -- backups/novexa-<horodatage>.archive.enc
```

Vérifiez ensuite sur la base de contrôle que les collections sont présentes, que les
volumes correspondent, et qu'un IBAN se déchiffre correctement avec la clé en vigueur.

---

## En cas de problème

```bash
npm run smoke -- https://votre-domaine     # qu'est-ce qui ne va pas
bash scripts/rollback.sh                   # retour au commit précédent
bash scripts/rollback.sh <sha>             # retour à un commit précis
```

`rollback.sh` met de côté le travail non commité, conserve l'état actuel sur une
branche de secours, et **signale ce qu'un retour de code ne défait pas** : migration de
chiffrement appliquée, entrées d'audit purgées par l'index TTL, effacements RGPD
exécutés. Dans ces cas, la restauration d'une sauvegarde est la seule voie.

### Symptômes fréquents

| Symptôme | Cause probable |
|---|---|
| Le service ne démarre pas, `FATAL` dans les logs | `DATA_ENCRYPTION_KEY` absente ou mal formée en production |
| Les clients paient mais n'ont pas accès | `checkout.session.completed` non souscrit, ou `STRIPE_WEBHOOK_SECRET` erroné |
| IBAN affichés comme `enc:v1:…` | Ancienne version du code sur des données migrées |
| IBAN vides après restauration | `DATA_ENCRYPTION_KEY` différente de celle en vigueur lors de la sauvegarde |
| Tout le monde est limité en même temps | `TRUST_PROXY_HOPS` incorrect : les quotas sont devenus collectifs |
| Le back-office renvoie 503 | `ADMIN_TOTP_SECRET` absent en production |
| Un client dit avoir perdu l'accès | Bascule en lecture seule : vérifiez son abonnement (phase 0) |

---

## Référence des commandes

| Commande | Rôle |
|---|---|
| `npm run check-env` | Vérifie la configuration |
| `npm run generate:key` | Génère la clé de chiffrement |
| `npm run admin:mfa` | Génère et enrôle le second facteur |
| `npm run migrate:chiffrement` | Chiffre les données existantes |
| `npm run audit:parc` | Liste les comptes qui basculeront en lecture seule |
| `npm run preflight` | Contrôles avant déploiement |
| `npm run smoke -- <url>` | Vérification après déploiement |
| `npm run backup` | Sauvegarde chiffrée |
| `npm run restore -- <archive>` | Restauration |
| `bash scripts/rollback.sh` | Retour arrière |
