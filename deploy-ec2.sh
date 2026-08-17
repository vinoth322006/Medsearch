#!/usr/bin/env bash
# =============================================================================
# MedSearch — EC2 Bootstrap & Deploy Script
# =============================================================================
# Run on a fresh Ubuntu 24.04 LTS EC2 instance:
#   chmod +x deploy-ec2.sh && sudo ./deploy-ec2.sh
# =============================================================================
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[MedSearch]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Must run as root ─────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  err "Please run with sudo:  sudo ./deploy-ec2.sh"
  exit 1
fi

# ── 1. System update & dependencies ─────────────────────────────────
log "Updating system packages..."
apt-get update -y && apt-get upgrade -y

log "Installing Docker, Git, and Certbot..."
apt-get install -y \
  ca-certificates curl gnupg lsb-release git \
  certbot python3-certbot-nginx

# Docker official GPG key & repo
if ! command -v docker &> /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  log "Docker installed successfully."
else
  log "Docker already installed, skipping."
fi

# Add current (non-root) user to docker group
REAL_USER="${SUDO_USER:-$USER}"
if [ "$REAL_USER" != "root" ]; then
  usermod -aG docker "$REAL_USER"
  log "Added $REAL_USER to docker group (re-login to take effect)."
fi

# ── 2. Clone or update the repository ────────────────────────────────
APP_DIR="/opt/medsearch"

if [ -d "$APP_DIR/.git" ]; then
  log "Repository exists at $APP_DIR, pulling latest..."
  cd "$APP_DIR"
  git pull origin main || warn "git pull failed — using existing code."
else
  log "Cloning MedSearch repository..."
  echo ""
  echo "Enter your GitHub repo URL (e.g. https://github.com/youruser/Medsearch.git):"
  read -r REPO_URL
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 3. Generate production .env files ────────────────────────────────
log "Setting up production environment files..."

# Generate strong random secrets
ACCESS_SECRET=$(openssl rand -hex 32)
REFRESH_SECRET=$(openssl rand -hex 32)
PG_PASSWORD=$(openssl rand -hex 16)

if [ ! -f "$APP_DIR/server/.env.prod" ]; then
  cat > "$APP_DIR/server/.env.prod" <<EOF
NODE_ENV=production
PORT=4000

# Database (internal Docker network — container hostname "postgres")
DATABASE_URL=postgresql://medisearch:${PG_PASSWORD}@postgres:5432/medisearch?schema=public

# Redis (internal Docker network — container hostname "redis")
REDIS_URL=redis://redis:6379

# Auth secrets (auto-generated — keep safe!)
JWT_ACCESS_SECRET=${ACCESS_SECRET}
JWT_REFRESH_SECRET=${REFRESH_SECRET}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

# External APIs
LITSENSE_BASE_URL=https://www.ncbi.nlm.nih.gov/research/litsense-api/api/
LITSENSE_TIMEOUT_MS=8000
LITSENSE_MIN_INTERVAL_MS=1000
EUTILS_BASE_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
EUTILS_API_KEY=
EUTILS_TIMEOUT_MS=8000
EUTILS_MIN_INTERVAL_MS=334

# Cache
SEARCH_CACHE_TTL_SEC=1200
META_CACHE_TTL_SEC=2592000

# Rate limits
ANON_IP_RATE_LIMIT_PER_MIN=12
AUTH_RATE_LIMIT_PER_MIN=30
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MIN=15

# CORS — update to your domain after setting up DNS
CORS_ORIGIN=http://localhost

# Seed admin — CHANGE THESE after first deploy!
SEED_ADMIN_EMAIL=admin@medsearch.local
SEED_ADMIN_PASSWORD=AdminPass!2024

# Privacy
ADMIN_CAN_VIEW_USER_QUERIES=false

# Logging
LOG_LEVEL=info
EOF
  log "Created server/.env.prod with auto-generated secrets."
  warn "IMPORTANT: Edit $APP_DIR/server/.env.prod to set your domain in CORS_ORIGIN"
  warn "           and update SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD before seeding."
else
  log "server/.env.prod already exists — skipping generation."
  # Extract PG_PASSWORD from existing file for docker-compose
  PG_PASSWORD=$(grep -oP 'medisearch:\K[^@]+' "$APP_DIR/server/.env.prod" | head -1)
fi

# Create root-level .env for docker-compose variable substitution
cat > "$APP_DIR/.env" <<EOF
POSTGRES_USER=medisearch
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=medisearch
CORS_ORIGIN=http://localhost
EOF
log "Created root .env for Docker Compose."

# ── 4. Build and start containers ────────────────────────────────────
log "Building and starting all containers..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d --build

# Wait for containers to be healthy
log "Waiting for services to become healthy..."
sleep 10

# ── 5. Run database migrations + seed ────────────────────────────────
log "Running Prisma migrations..."
docker compose -f docker-compose.prod.yml exec -T server sh -c "npx prisma migrate deploy"

log "Seeding admin user..."
docker compose -f docker-compose.prod.yml exec -T server sh -c "npx prisma generate && node -e \"
  require('./dist/db/prisma');
  const { execSync } = require('child_process');
  execSync('npx tsx src/db/seed.ts', { stdio: 'inherit' });
\""  2>/dev/null || {
  warn "Auto-seed failed. Run manually:"
  warn "  cd $APP_DIR && docker compose -f docker-compose.prod.yml exec server npm run seed"
}

# ── 6. Verify ────────────────────────────────────────────────────────
echo ""
log "========================================="
log "  MedSearch deployment complete!"
log "========================================="
echo ""

# Get public IP
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "YOUR_EC2_IP")

echo -e "  ${GREEN}Frontend:${NC}  http://${PUBLIC_IP}"
echo -e "  ${GREEN}API:${NC}       http://${PUBLIC_IP}/api/"
echo ""
echo -e "  ${YELLOW}Container status:${NC}"
docker compose -f docker-compose.prod.yml ps
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "  1. Point your domain DNS A-record to: ${PUBLIC_IP}"
echo "  2. Update CORS_ORIGIN in $APP_DIR/server/.env.prod with your domain"
echo "  3. Update CORS_ORIGIN in $APP_DIR/.env with your domain"
echo "  4. Run: sudo certbot --nginx -d yourdomain.com  (for free HTTPS)"
echo "  5. Restart: cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo "  View logs:   docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:     docker compose -f docker-compose.prod.yml restart"
echo "  Stop:        docker compose -f docker-compose.prod.yml down"
echo "  Rebuild:     docker compose -f docker-compose.prod.yml up -d --build"
echo ""
