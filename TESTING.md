# Tests — Novexa Backend

La suite de tests est organisée en deux niveaux : **unitaires** (rapides, sans base de
données) et **intégration** (routes Express réelles sur une base MongoDB éphémère).

## Lancer les tests

```bash
# Tests unitaires — logique métier pure, aucun service externe requis
npm test

# Tests d'intégration — démarrent une base MongoDB (mémoire ou service)
npm run test:integration

# Tout
npm run test:all
```

> Prérequis pour toutes les suites : la variable `JWT_SECRET` doit être définie.
> En CI, une valeur de test suffit : `JWT_SECRET=test_secret_ci_only`.

## Tests unitaires (`tests/unit/`)

Exécutables partout, y compris sans réseau. Couvrent la logique métier isolée :

| Fichier | Couverture |
|---|---|
| `payslip.test.js` | Génération de fiche de paie 2024 : brut, cotisations, PAS, autres éléments, congés |
| `tva.test.js` | Calcul de TVA (HT→TTC, TTC→HT) |
| `sanitize.test.js` | Sanitisation anti-injection NoSQL |
| `errorResponse.test.js` | Mapping des erreurs → codes HTTP (400 / 409 / 500) |

## Tests d'intégration (`tests/integration/`)

Chaque module métier est testé pour :

- **401** sans authentification ;
- **création** + validation des entrées ;
- **cloisonnement multi-tenant** (une entreprise ne voit jamais les données d'une autre) ;
- **protection IDOR** (impossible de lire/modifier/supprimer les ressources d'une autre entreprise → 404) ;
- **workflows métier** (statuts, approbations, génération de paie…).

Modules couverts : `auth`, `comptabilite`, `rh`, `crm`, `stocks`, `projets`, `tickets`,
`budget`, `notesFrais`, `avoirs`, `immobilisations`, `agenda`, `bonCommandes`,
`centresAnalytiques`, plus `health`.

### Base de données de test

Le helper `tests/helpers/db.js` choisit automatiquement :

1. **`MONGODB_URI`** s'il est défini (ex. service MongoDB de la CI) ;
2. sinon une instance **`mongodb-memory-server`** (téléchargée au premier lancement —
   nécessite un accès réseau à `fastdl.mongodb.org`).

En local, sans MongoDB installé, la première exécution télécharge un binaire MongoDB.
En CI, le workflow fournit un service `mongo:7` via `MONGODB_URI`.

## Intégration continue

`.github/workflows/ci.yml` exécute à chaque push :

1. `npm audit --omit=dev --audit-level=high` (sécurité des dépendances) ;
2. `npm test` (unitaires) ;
3. `npm run test:integration` (contre le service `mongo:7`) ;
4. vérification syntaxe de tous les fichiers `.js` ;
5. build Docker + smoke test `/api/health`.

## Conventions

- Environnement de test : `NODE_ENV=test` (désactive la connexion Mongo au démarrage,
  la boucle de reconnexion et l'ouverture du port réseau).
- Isolation : chaque suite d'intégration crée ses propres entreprises via
  `POST /api/auth/register` et travaille avec des jetons Bearer distincts.
