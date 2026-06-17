# Novexa — Plateforme SaaS IA de Gestion d'Entreprise

> Créé par **Nexulys** · Version 1.0.0

Novexa est une plateforme SaaS complète propulsée par l'IA qui automatise la comptabilité, les ressources humaines, la gestion des stocks et les tâches de votre entreprise.

## Modules

| Module | Fonctionnalités |
|--------|----------------|
| 📊 **Comptabilité** | Factures (TVA auto 20%), dépenses, bilan mensuel/annuel |
| 👥 **Ressources Humaines** | Employés, contrats CDI/CDD/Freelance, congés, fiches de paie |
| 📦 **Stocks** | Produits (SKU), mouvements entrée/sortie, alertes, fournisseurs |
| ✅ **Tâches** | Tâches, projets, automatisations métier |
| 🤖 **IA (GPT-4o-mini)** | Analyse dépenses, assistant RH, prédiction stock, insights dirigeant |

## Tarif

**Novexa Pro — 2 500 € / mois**
- Essai gratuit 14 jours
- Utilisateurs illimités
- Tous modules inclus
- Support prioritaire 24/7

## Démarrage rapide

### Prérequis
- Docker & Docker Compose
- Node.js 20+ (développement local)

### Installation en 1 commande

```bash
curl -sSL https://raw.githubusercontent.com/nexulys/nexulys-backend/main/deploy.sh | bash
```

### Installation manuelle

```bash
# 1. Cloner le dépôt
git clone https://github.com/nexulys/nexulys-backend.git
cd nexulys-backend

# 2. Configurer l'environnement
cp .env.example .env
nano .env  # configurer MongoDB URI, JWT_SECRET, OpenAI, SMTP, Stripe

# 3. Lancer avec Docker
docker-compose up -d

# 4. Charger les données démo
npm run seed

# 5. Accéder à l'application
open http://localhost:5000
```

### Développement local

```bash
npm install
npm run dev        # nodemon
npm test           # Jest tests
npm run seed       # données démo
```

## Structure du projet

```
nexulys-backend/
├── controllers/       # Logique métier (7 controllers)
├── models/            # Schémas Mongoose (15 modèles)
├── routes/            # Endpoints API (7 routers + docs + stripe)
├── middleware/        # Auth JWT, rate limit, validation
├── services/          # Stripe, Email
├── utils/             # Logger, Mailer, TVA, Paie
├── scripts/           # Seed de données
├── tests/             # Tests Jest/Supertest
├── public/            # Frontend (landing, dashboard, login)
├── nginx/             # Config Nginx production
├── .github/workflows/ # CI/CD GitHub Actions
├── Dockerfile
└── docker-compose.yml
```

## API Endpoints

Documentation interactive : `http://localhost:5000/api/docs`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/comptabilite/factures` | Lister les factures |
| POST | `/api/comptabilite/factures` | Créer une facture |
| GET | `/api/comptabilite/bilan` | Bilan annuel |
| GET | `/api/rh/employes` | Lister les employés |
| POST | `/api/rh/paie/generer` | Générer une fiche de paie |
| GET | `/api/stocks/alertes` | Alertes stock bas |
| GET | `/api/ai/dashboard-insights` | Insights IA |
| GET | `/api/health` | Santé de l'API |

## Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `MONGODB_URI` | URI MongoDB | ✅ |
| `JWT_SECRET` | Clé secrète JWT | ✅ |
| `OPENAI_API_KEY` | Clé API OpenAI | ⚡ IA |
| `SMTP_HOST` | Serveur SMTP | 📧 Emails |
| `STRIPE_SECRET_KEY` | Clé Stripe | 💳 Paiements |

## Déploiement production

### VPS (recommandé)

```bash
# Sur votre serveur
./deploy.sh main

# Configurer Nginx
sudo cp nginx/novexa.conf /etc/nginx/sites-available/novexa
sudo ln -s /etc/nginx/sites-available/novexa /etc/nginx/sites-enabled/
sudo certbot --nginx -d votre-domaine.com
sudo nginx -t && sudo systemctl reload nginx
```

### Secrets GitHub Actions requis

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | IP ou domaine du serveur |
| `DEPLOY_USER` | Utilisateur SSH |
| `DEPLOY_SSH_KEY` | Clé privée SSH |
| `APP_URL` | URL de production |

## Compte démo

Après `npm run seed` :
- **Email** : `admin@techcorp.fr`
- **Mot de passe** : `novexa2025`

## Tech Stack

- **Runtime** : Node.js 20 + Express 4
- **Base de données** : MongoDB 7 + Mongoose
- **Auth** : JWT + bcryptjs
- **IA** : OpenAI GPT-4o-mini
- **Paiements** : Stripe
- **Emails** : Nodemailer
- **Logs** : Winston
- **Tests** : Jest + Supertest
- **Docs** : Swagger UI
- **Deploy** : Docker + Nginx + GitHub Actions

---

**Novexa by Nexulys** · © 2026 · Tous droits réservés
