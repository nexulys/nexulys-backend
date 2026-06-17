#!/bin/bash
set -e

echo "🚀 Déploiement Novexa by Nexulys"
echo "================================="

# Config
APP_DIR="/opt/novexa"
REPO_URL="https://github.com/nexulys/nexulys-backend.git"
BRANCH="${1:-main}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check dependencies
command -v docker >/dev/null 2>&1 || error "Docker requis"
command -v docker-compose >/dev/null 2>&1 || error "Docker Compose requis"

# Clone or update
if [ -d "$APP_DIR" ]; then
  log "Mise à jour du code..."
  cd "$APP_DIR"
  git pull origin "$BRANCH"
else
  log "Clonage du dépôt..."
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# Check .env
if [ ! -f ".env" ]; then
  warn ".env introuvable — copie depuis .env.example"
  cp .env.example .env
  warn "⚠️  Configurez le fichier .env avant de continuer !"
  warn "   Éditez: nano $APP_DIR/.env"
  exit 1
fi

# Create logs dir
mkdir -p logs

# Build and start
log "Build et démarrage des conteneurs..."
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

# Wait for MongoDB
log "Attente MongoDB..."
sleep 8

# Health check
log "Vérification santé API..."
for i in {1..10}; do
  if curl -sf http://localhost:5000/api/health > /dev/null; then
    log "API démarrée avec succès"
    break
  fi
  [ $i -eq 10 ] && error "L'API ne répond pas après 10 tentatives"
  sleep 3
done

# Optional seed
read -p "Charger les données de démo ? (o/N) " seed_confirm
if [[ "$seed_confirm" =~ ^[Oo]$ ]]; then
  docker-compose exec novexa-api node scripts/seed.js
  log "Données démo chargées"
fi

echo ""
echo -e "${GREEN}✅ Novexa déployé avec succès !${NC}"
echo ""
echo "  🌐 Application : http://localhost:5000"
echo "  📚 API Docs    : http://localhost:5000/api/docs"
echo "  🗄️  Mongo UI   : http://localhost:8081"
echo ""
echo "  Compte démo : admin@techcorp.fr / novexa2025"
echo ""
