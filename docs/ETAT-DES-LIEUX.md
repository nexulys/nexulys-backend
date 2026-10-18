# État des lieux — ce qui manque pour que Novexa soit fonctionnel

Audit du 18 octobre 2026, sur la branche `claude/novexa-saas-platform-a8ar1j`
(18 commits d'avance sur ce qui est en ligne).

Méthode : confrontation des 229 routes de l'API aux 169 appels du frontend, lecture du
moteur de paie, du calcul de TVA, du générateur Factur-X, de la chaîne de facturation
Stripe, des 46 variables d'environnement, des documents légaux et des 194 tests.
**Limite de l'audit** : MongoDB est inaccessible depuis l'environnement d'analyse
(le proxy refuse le téléchargement du binaire), donc aucun parcours n'a pu être exécuté
en base réelle. Tout ce qui suit vient de la lecture du code, de l'exécution des tests
unitaires et de vérifications dans un navigateur.

---

## Verdict

La plateforme est techniquement bien plus avancée que ce que son état « non déployé »
suggère : 229 routes d'API, 11 modules, 194 tests au vert, chiffrement des données
sensibles, RGPD outillé, facturation Stripe réelle. **Trois choses manquent pour
qu'elle soit fonctionnelle, et elles ne sont pas de même nature :**

1. **une immatriculation** — sans elle, aucune vente n'est possible, et vos propres
   mentions légales le disent ;
2. **treize variables d'environnement** — sans elles le service démarre dégradé ou pas
   du tout ;
3. **la conformité de la paie** — sans elle le module RH ne peut pas être vendu à une
   entreprise française.

Le reste est du confort, de la dette ou de l'amélioration.

---

## 1. Ce qui fonctionne réellement

| Domaine | État |
|---|---|
| API | 229 routes montées, aucun handler manquant |
| Modules | Comptabilité (15 sous-onglets), RH, Stocks, Tâches, CRM, Projets, Agenda, IA, Support, Paramètres |
| Authentification | JWT avec révocation par `tokenVersion`, bcrypt 12 tours, MFA TOTP sur le back-office |
| Isolation multi-client | Scoping par `company` vérifié : aucun accès par identifiant direct non contrôlé |
| Facturation | Stripe Checkout avec tarifs créés à la volée depuis `config/plans.js` — **aucun identifiant de prix à configurer** |
| Abonnement | Essai 14 jours automatique, bascule en lecture seule à l'expiration, quotas par plan |
| Chiffrement | IBAN et NIR chiffrés au repos (AES-256-GCM) |
| RGPD | Effacement effectif avec rétractation 30 jours, export, registre, DPA, procédure de violation |
| Sauvegardes | Scripts de sauvegarde et restauration chiffrés, vérifiés de bout en bout |
| Tests | 194 unitaires + 16 fichiers d'intégration, CI verte |
| Documents légaux | Mentions légales, CGV, politique de confidentialité, CGU : rédigés, sans gabarit à trous |

---

## 2. Le blocage n°1 : l'immatriculation

Vos mentions légales, en ligne, déclarent :

> « Statut : Projet "Nexulys" — activité en cours de création (entreprise non encore
> immatriculée) […] Tant que l'immatriculation n'est pas effective, aucune vente ni
> facturation commerciale ne peut être réalisée ; les fonctionnalités payantes sont
> présentées à titre informatif. »

C'est exact, et c'est le vrai verrou. Trois conséquences concrètes :

- **Stripe ne peut pas passer en production.** L'activation des paiements réels exige
  une entité juridique vérifiée (procédure KYC). Sans SIREN, vous restez en mode test :
  les paiements aboutissent mais n'encaissent rien.
- **Vous ne pouvez pas facturer.** Une facture sans SIREN ni, le cas échéant, numéro de
  TVA intracommunautaire n'est pas une facture valable.
- **Vos clients vous confieront des données de paie.** Un sous-traitant au sens du RGPD
  qui n'existe pas juridiquement ne peut pas signer le DPA que vous avez pourtant rédigé.

Tout le travail technique de facturation est fait et attend ce préalable. Rien dans le
code ne peut le remplacer.

---

## 3. Les treize variables à renseigner

`render.yaml` les déclare en `sync: false` : le fichier les réserve, c'est à vous de les
remplir dans le tableau de bord de l'hébergeur.

| Variable | Sans elle | Priorité |
|---|---|---|
| `MONGODB_URI` | Le service répond 503 : aucune donnée lisible | **Bloquant** |
| `DATA_ENCRYPTION_KEY` | Le serveur refuse de démarrer en production | **Bloquant** |
| `APP_URL` | Liens des e-mails et retours Stripe cassés | **Bloquant** |
| `STRIPE_SECRET_KEY` | Aucune souscription possible | Bloquant si vente |
| `STRIPE_WEBHOOK_SECRET` | Les paiements aboutissent sans ouvrir l'accès | Bloquant si vente |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Aucun e-mail : pas de mot de passe oublié, pas de relance, pas de bienvenue | **Bloquant** |
| `GROQ_API_KEY` **ou** `OPENAI_API_KEY` | L'IA renvoie des données simulées (voir §4) | **Bloquant** |
| `ADMIN_TOTP_SECRET` | Back-office inaccessible | Haute |
| `ADMIN_EMAIL` | Lien vers le back-office non affiché | Basse |
| `SENTRY_DSN` | Voir le piège ci-dessous | À retirer |

`JWT_SECRET`, `ADMIN_SECRET` et `CRON_SECRET` sont générés automatiquement par Render.

**Piège `SENTRY_DSN`.** `middleware/sentry.js` fait `require('@sentry/node')`, mais ce
paquet **n'est pas dans `package.json`**. Le `require` est protégé par un `try/catch`,
donc rien ne casse — mais renseigner `SENTRY_DSN` donne l'illusion d'une supervision
inexistante. De plus le code utilise l'API Sentry v7 (`Sentry.Integrations.Http`),
supprimée dans les versions récentes. **Décision à prendre : installer le paquet dans la
bonne version, ou retirer la variable de `render.yaml`.** Ne laissez pas l'ambiguïté.

Vérification avant bascule : `NODE_ENV=production npm run check-env`, puis
`FRONTEND_ORIGIN=https://novexa.nexulyspro2002.workers.dev npm run smoke -- <url>`.

---

## 4. Ce qui est annoncé mais ne tient pas

### 4.1 L'IA fabrique des données quand elle n'est pas configurée

`controllers/aiController.js` utilise Groq (`llama-3.1-8b-instant`) ou OpenAI
(`gpt-4o-mini`). **Sans clé, le mode démo renvoie `success: true` avec des valeurs
inventées** — la lecture d'un justificatif retourne « Achat simulé, 42,50 € ». Le champ
`fiabilite: 0` et une note le signalent, mais l'interface remplit quand même le
formulaire de dépense. Un utilisateur pressé enregistre une écriture fabriquée.

Deux corrections à décider :
- renseigner une clé (Groq a une offre gratuite) ;
- **et** faire refuser le mode démo plutôt que répondre `success: true` : sur un produit
  comptable, une donnée inventée est pire qu'une erreur affichée.

Sur le choix du modèle : `llama-3.1-8b-instant` est un petit modèle rapide. Pour de
l'extraction sur facture, où une erreur de montant se propage en comptabilité, un modèle
plus capable se justifie.

### 4.2 Le moteur de paie n'est pas conforme

C'est le point le plus lourd. `utils/payslipGenerator.js` produit un bulletin détaillé
et présentable, mais :

**Les taux sont figés sur 2024.** Le plafond mensuel de la Sécurité sociale est codé en
dur à 3 864 € (`PMSS_2024`), le SMIC à 1 766,92 €, le seuil de 3,5 SMIC pour les
allocations familiales à 6 182 €. Ces valeurs ont été revalorisées deux fois depuis.
Toutes les cotisations assises sur la tranche 1 (vieillesse plafonnée, Arrco T1, CEG,
FNAL) sont donc fausses.

**Il manque des éléments obligatoires ou majeurs :**

| Manque | Effet |
|---|---|
| **Montant net social** | Obligatoire sur tout bulletin français depuis le 1ᵉʳ juillet 2023. Son absence rend **chaque bulletin produit non conforme** |
| **Réduction générale des cotisations patronales** | Pour un salaire jusqu'à 1,6 SMIC, c'est le premier poste d'allègement. Son absence surévalue massivement le coût employeur |
| **Tranche 2 Agirc-Arrco** (au-delà du plafond) | Tout salaire supérieur au plafond est sous-cotisé. Un cadre à 5 000 € a un bulletin matériellement faux |
| **CET, APEC, prévoyance cadres** | Cotisations manquantes pour les cadres |
| **Formation professionnelle, taxe d'apprentissage, versement mobilité, PEEC** | Charges patronales absentes |
| **Proratisation** | `HEURES_LEGALES` est fixe : ni temps partiel, ni entrée ou sortie en cours de mois |
| **Heures supplémentaires** | Majoration unique de 25 % : la majoration à 50 % au-delà de la 8ᵉ heure, la réduction salariale et l'exonération d'impôt sont absentes |
| **Taux AT/MP** | Fixé à 2,22 % « taux moyen ». Le vrai taux est notifié par la Carsat par établissement |
| **Mutuelle** | 1 % / 1,5 %, valeurs que le code lui-même qualifie d'« indicatives », imprimées sur un document légal |

**Et surtout : il n'y a pas de DSN.** Ce que le tableau de bord appelle « Export DSN »
produit un **CSV récapitulatif** avec des cotisations estimées à « ~42 % » et « ~22 % ».
Une DSN est une déclaration au format NEODeS transmise à net-entreprises.fr. Ce fichier
ne peut pas être déposé.

**Conséquence commerciale** : le module RH ne peut pas être vendu en l'état à une
entreprise française. Un bulletin non conforme expose votre client à un redressement, et
vous expose contractuellement. Trois voies, à trancher :

1. **Retirer la paie de l'offre** et vendre la comptabilité seule — le plan Business la
   met pourtant en avant (« RH & fiches de paie françaises ») ;
2. **Déléguer** à un moteur de paie tiers conforme et maintenu ;
3. **Internaliser** la conformité : table de taux versionnée par année, réduction
   générale, tranches, net social, DSN NEODeS. C'est un chantier de plusieurs mois, avec
   une veille réglementaire permanente.

L'option 1 ou 2 est la seule raisonnable avant commercialisation.

### 4.3 La facture électronique est à moitié faite

`utils/facturx.js` produit du XML CII (UN/CEFACT, profil EN 16931) correct. Mais une
facture Factur-X **est un PDF/A-3 avec le XML embarqué**, et l'embarquement n'est pas
fait : le commentaire du fichier renvoie la tâche au prestataire. `pdfkit`, utilisé pour
les PDF, ne produit pas de PDF/A-3.

Par ailleurs les huit variables `PDP_*` (plateforme de dématérialisation partenaire,
adaptateur Iopole présent) **ne sont pas dans `render.yaml`** : la transmission n'est pas
configurée.

Point de calendrier à vérifier auprès d'un conseil : selon le calendrier de la réforme,
**l'obligation de recevoir des factures électroniques s'applique à toutes les entreprises
depuis septembre 2026**, l'obligation d'émettre arrivant par paliers. Si c'est exact, vos
clients PME sont déjà concernés par la réception — et c'est un argument commercial autant
qu'une contrainte. Les dates de cette réforme ont déjà été repoussées : confirmez-les
avant de les mettre en avant.

### 4.4 La TVA ne gère qu'un taux par facture

`models/Invoice.js` porte un seul champ `tauxTVA` (défaut 20). Les lignes n'ont pas de
taux propre. Donc : impossible de facturer une prestation à 20 % et un produit à 5,5 %
sur la même facture. Manquent aussi l'exonération, l'autoliquidation, la mention
« TVA non applicable, art. 293 B du CGI » pour les micro-entreprises, et le choix entre
TVA sur les débits et sur les encaissements.

C'est une limite fonctionnelle réelle pour un outil de facturation français, pas un bug.

---

## 5. Défauts de robustesse et de sécurité restants

| Point | Détail |
|---|---|
| **Pas de vérification d'adresse e-mail** | N'importe qui crée un compte avec l'adresse d'un tiers, reçoit 14 jours d'essai, et l'adresse non vérifiée sert ensuite à la réinitialisation du mot de passe |
| **Mot de passe : 6 caractères minimum** | Aucune règle de complexité, aucun contrôle contre les mots de passe compromis. 12 caractères est la recommandation courante |
| **Montants en nombres flottants** | 52 champs monétaires en `type: Number` (double IEEE 754). Les arrondis à deux décimales limitent la casse, mais pour de la comptabilité un type décimal est préférable |
| **Code mort embarqué** | `deliverables/05-server.js` (700 lignes) décrit une **autre** architecture (PostgreSQL/Prisma, Anthropic) que celle en production (MongoDB/Mongoose, Groq/OpenAI). Il n'est jamais chargé. À déplacer en documentation ou supprimer : c'est un piège pour quiconque reprend le code |
| **Zones non testées** | Les quatre fonctionnalités mortes trouvées aujourd'hui étaient toutes dans des contrôleurs sans test : `rapprochement`, `projets`, `ai`. Restent sans couverture : `pdf`, `portail`, `devis`, `recurrence`, `taches`, `contratClient`, `notesFrais` |

---

## 6. Ce que j'ai corrigé aujourd'hui

La confrontation systématique des 229 routes aux 169 appels du frontend a révélé
**quatre fonctionnalités livrées mortes** : l'API répondait 404, le frontend lisait un
corps vide, l'écran restait muet — rien dans les journaux, rien à l'écran.

| Fonctionnalité | Cause |
|---|---|
| Lecture automatique d'une facture collée | Appelait `POST /api/ai/analyse`, route qui n'a jamais existé |
| Liste des saisies de temps | Appelait `GET /api/projets/temps`, non exposée — l'onglet affichait toujours « Aucune saisie » |
| Détail d'un relevé bancaire | Appelait `GET /api/rapprochement/:id`, absent |
| Rapprochement d'une transaction | Visait `/:id/rapprocher/:idx` au lieu de `/:id/transactions/:idx/rapprocher` |

`tests/unit/cablageFrontend.test.js` verrouille désormais ce contrôle dans la CI.
Contrôle négatif vérifié : remettre l'ancienne URL fait échouer la suite.

---

## 7. Plan d'action, dans l'ordre

**Pour mettre le site en ligne et utilisable par vous-même** (quelques heures)

1. Renseigner les treize variables du §3, puis `npm run check-env`.
2. Trancher le cas `SENTRY_DSN` : installer le paquet ou retirer la variable.
3. Déployer la branche `a8ar1j` (18 commits, CI verte) et les pages
   (`npx wrangler deploy`, phase 6 bis du runbook).
4. Vérifier avec `npm run smoke`, puis ouvrir `/diagnostic.html`.
5. Générer les trois secrets et tester une restauration de sauvegarde.

**Pour pouvoir vendre** (dépend de démarches, pas de code)

6. Immatriculer l'entreprise, mettre à jour les mentions légales, activer Stripe en
   production.
7. Faire relire CGV, CGU et politique de confidentialité par un juriste.
8. Décider du sort du module paie : retirer de l'offre, déléguer, ou internaliser.
9. Faire relire le calcul de TVA et le format Factur-X par un expert-comptable.

**Pour que le produit tienne dans le temps**

10. Vérification d'adresse e-mail et politique de mot de passe.
11. Table de taux de paie versionnée par année, si la paie est conservée.
12. TVA multi-taux par ligne de facture.
13. Tests sur les sept contrôleurs non couverts.
14. Supervision réelle, et nettoyage de `deliverables/`.
