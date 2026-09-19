# Registre des activités de traitement

> **Modèle à faire valider.** Établi d'après l'article 30.2 du RGPD (registre du
> sous-traitant) et d'après le code réel de la plateforme. Ce n'est pas un conseil
> juridique. Les champs `<À COMPLÉTER>` relèvent de votre organisation.
>
> Ce registre est **obligatoire** et doit pouvoir être présenté à la CNIL sur demande.
> Tenez-le à jour : toute nouvelle finalité, tout nouveau sous-traitant ou toute
> nouvelle catégorie de données doit y figurer.

**Responsable du registre** : `<NOM, FONCTION>` — `<EMAIL>`
**Dernière mise à jour** : `<DATE>`

---

## Identité du sous-traitant

| | |
|---|---|
| Raison sociale | `<RAISON SOCIALE NEXULYS>` |
| SIRET | `<SIRET>` |
| Adresse | `<ADRESSE>` |
| Représentant | `<NOM, QUALITÉ>` |
| Référent protection des données | `<NOM / EMAIL>` |
| DPO désigné | `<OUI / NON — si oui, coordonnées>` |

## Catégories de traitements réalisés pour le compte des clients

### T1 — Gestion commerciale et facturation
- **Personnes concernées** : clients et prospects du client, ses contacts fournisseurs
- **Données** : identité, coordonnées, données de facturation, encours
- **Destinataires** : le client, la plateforme agréée de facturation électronique (PDP)
- **Conservation** : durée de l'abonnement, puis effacement (art. 9 du DPA)

### T2 — Comptabilité
- **Personnes concernées** : clients, fournisseurs, salariés (notes de frais)
- **Données** : pièces comptables, montants, dates, rapprochements bancaires
- **Destinataires** : le client, son expert-comptable via un accès en lecture seule
- **Conservation** : durée de l'abonnement, puis effacement

### T3 — Ressources humaines et paie
- **Personnes concernées** : salariés du client
- **Données** : identité, coordonnées, date de naissance, poste, rémunération, taux de
  prélèvement à la source, **IBAN**, **numéro de sécurité sociale (NIR)**, congés, contrats
- **Mesure particulière** : IBAN et NIR chiffrés au repos (AES-256-GCM) ; NIR strictement
  limité à la finalité paie
- **Destinataires** : le client
- **Conservation** : durée de l'abonnement, puis effacement

### T4 — Relation client et signature électronique
- **Personnes concernées** : clients et prospects du client
- **Données** : identité, coordonnées, historique commercial, devis et contrats signés,
  horodatage et trace de signature
- **Mesure particulière** : accès par jeton aléatoire de 192 bits, transmis hors URL
  (fragment et en-tête), expirant à échéance paramétrable
- **Conservation** : durée de l'abonnement, puis effacement

### T5 — Assistance par intelligence artificielle
- **Personnes concernées** : indirectement, les personnes figurant dans les données analysées
- **Données** : agrégats de gestion, intitulés de dépenses, textes soumis par l'utilisateur
- **Destinataire** : `<FOURNISSEUR IA>` — `<PAYS>`
- **Point de vigilance** : vérifier contractuellement la non-réutilisation des données
  aux fins d'entraînement, et documenter le transfert si le fournisseur est hors UE
- **Conservation** : `<À COMPLÉTER — politique du fournisseur>`

### T6 — Fonctionnement du service (traitements propres à Nexulys)
- **Personnes concernées** : utilisateurs de la plateforme
- **Données** : comptes utilisateurs, journaux d'accès, adresses IP, journal d'audit
- **Finalité** : sécurité, preuve, support, facturation de l'abonnement
- **Base légale** : intérêt légitime (sécurité) et exécution du contrat
- **Conservation** : voir le tableau ci-dessous

## Durées de conservation

Ces durées correspondent à ce qui est **effectivement implémenté** dans le code, sauf
mention `<À DÉFINIR>`.

| Donnée | Durée | Où c'est déterminé |
|---|---|---|
| Session authentifiée (JWT et cookie) | 7 jours | `authController.js`, révocable par `tokenVersion` |
| Jeton de réinitialisation de mot de passe | 1 heure | `authController.js` |
| Jeton d'accès portail client | 30 jours par défaut, plafond 365 | `portailController.js` |
| Jeton d'accès expert-comptable | 90 jours par défaut, plafond 365 | `expertController.js` |
| Demande d'effacement (délai de rétractation) | 30 jours | `rgpdService.js` |
| Sauvegardes chiffrées | 30 jours par défaut | `scripts/backup.sh` |
| Session du back-office plateforme | 8 heures | `adminController.js` |
| Données client après effacement | supprimées | `rgpdService.js` |
| Facturation de l'abonnement (compta Nexulys) | 10 ans, pseudonymisée | art. L123-22 code de commerce |
| Journal d'audit applicatif (IP, user-agent) | 365 jours | index TTL MongoDB, `AUDIT_RETENTION_DAYS` |
| Journaux applicatifs (fichiers) | 5 fichiers de 10 Mo glissants | `LOG_MAX_SIZE`, `LOG_MAX_FILES` |
| Journaux d'accès nginx | `<À DÉFINIR — configuration serveur>` | recommandation CNIL : 6 mois |

> La purge des journaux nginx relève de la configuration du serveur (`logrotate`), hors
> du périmètre applicatif. À mettre en place côté infrastructure.

## Transferts hors Union européenne

| Destinataire | Pays | Mécanisme | Statut |
|---|---|---|---|
| `<HÉBERGEUR>` | `<PAYS>` | `<CCT / décision d'adéquation>` | `<À VÉRIFIER>` |
| Stripe | `<PAYS>` | `<CCT>` | `<À VÉRIFIER>` |
| `<FOURNISSEUR IA>` | `<PAYS>` | `<CCT>` | `<À VÉRIFIER>` |

## Mesures de sécurité

Voir l'article 7 du DPA (`docs/RGPD-DPA.md`), qui décrit les mesures effectivement en
place : chiffrement au repos et en transit, cloisonnement par entreprise, contrôle
d'accès par rôle, second facteur sur l'administration, journalisation, sauvegardes
chiffrées vérifiées.
