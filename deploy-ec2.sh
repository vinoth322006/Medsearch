#!/usr/bin/env bash
# =============================================================================
# MedSearch — EC2 Bootstrap & Deploy Script (Streamlined)
# =============================================================================
# Run on a fresh Ubuntu 24.04 LTS EC2 instance:
#   chmod +x deploy-ec2.sh && sudo ./deploy-ec2.sh
#
# Architecture: 3 containers (Postgres + Redis + Express)
#               Express serves BOTH API and React SPA
#               Caddy on host handles automatic HTTPS (optional)
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[MedSearch]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

if [ "$EUID" -ne 0 ]; then
  err "Please run with sudo:  sudo ./deploy-ec2.sh"
  exit 1
fi

# ── 1. Install Docker ───────────────────────────────────────────────
log "Updating system..."
apt-get update -y && apt-get upgrade -y

if ! command -v docker &> /dev/null; then
  log "Installing Docker..."
  apt-get install -y ca-certificates curl gnupg lsb-release git

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker && systemctl start docker
  log "Docker installed."
else
  log "Docker already installed."
fi

# Add non-root user to docker group
REAL_USER="${SUDO_USER:-$USER}"
[ "$REAL_USER" != "root" ] && usermod -aG docker "$REAL_USER"

# ── 2. Install Caddy (for automatic HTTPS) ──────────────────────────
if ! command -v caddy &> /dev/null; then
  log "Installing Caddy (automatic HTTPS)..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
  log "Caddy installed."
else
  log "Caddy already installed."
fi

# ── 3. Clone or update repository ───────────────────────────────────
APP_DIR="/opt/medsearch"

if [ -d "$APP_DIR/.git" ]; then
  log "Pulling latest code..."
  cd "$APP_DIR" && git pull origin main || warn "git pull failed."
else
  echo ""
  echo "Enter your GitHub repo URL (e.g. https://github.com/youruser/Medsearch.git):"
  read -r REPO_URL
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 4. Generate production secrets ──────────────────────────────────
ACCESS_SECRET=$(openssl rand -hex 32)
REFRESH_SECRET=$(openssl rand -hex 32)
PG_PASSWORD=$(openssl rand -hex 16)

if [ ! -f "$APP_DIR/server/.env.prod" ]; then
  cat > "$APP_DIR/server/.env.prod" <<EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://medisearch:${PG_PASSWORD}@postgres:5432/medisearch?schema=public
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=${ACCESS_SECRET}
JWT_REFRESH_SECRET=${REFRESH_SECRET}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
LITSENSE_BASE_URL=https://www.ncbi.nlm.nih.gov/research/litsense-api/api/
LITSENSE_TIMEOUT_MS=8000
LITSENSE_MIN_INTERVAL_MS=1000
EUTILS_BASE_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
EUTILS_API_KEY=
EUTILS_TIMEOUT_MS=8000
EUTILS_MIN_INTERVAL_MS=334
SEARCH_CACHE_TTL_SEC=1200
META_CACHE_TTL_SEC=2592000
ANON_IP_RATE_LIMIT_PER_MIN=12
AUTH_RATE_LIMIT_PER_MIN=30
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MIN=15
CORS_ORIGIN=http://localhost
SEED_ADMIN_EMAIL=admin@medsearch.local
SEED_ADMIN_PASSWORD=AdminPass!2024
ADMIN_CAN_VIEW_USER_QUERIES=false
LOG_LEVEL=info
EOF
  log "Created server/.env.prod"
  warn "Edit $APP_DIR/server/.env.prod to set your domain in CORS_ORIGIN"
else
  PG_PASSWORD=$(grep -oP 'medisearch:\K[^@]+' "$APP_DIR/server/.env.prod" | head -1)
  log "server/.env.prod already exists."
fi

# Root .env for docker-compose variable substitution
cat > "$APP_DIR/.env" <<EOF
POSTGRES_USER=medisearch
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=medisearch
CORS_ORIGIN=http://localhost
HOST_PORT=80
EOF

# ── 5. Build & start (3 containers only) ────────────────────────────
log "Building and starting containers..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d --build

log "Waiting for services..."
sleep 12

# ── 6. Database migrations ──────────────────────────────────────────
log "Running Prisma migrations..."
docker compose -f docker-compose.prod.yml exec -T server sh -c "npx prisma migrate deploy" || {
  warn "Migration failed — you may need to run manually."
}

# ── 7. Done ─────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "YOUR_EC2_IP")

echo ""
log "========================================="
log "  MedSearch is live!"
log "========================================="
echo ""
echo -e "  ${GREEN}App:${NC}  http://${PUBLIC_IP}"
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "  1. Seed admin:  docker compose -f docker-compose.prod.yml exec server npm run seed"
echo "  2. For HTTPS:   Point your domain A-record to ${PUBLIC_IP}"
echo "  3. Edit Caddyfile: replace 'medsearch.yourdomain.com' with your domain"
echo "  4. Set HOST_PORT=4000 in .env (Caddy will take port 80/443)"
echo "  5. Restart:     docker compose -f docker-compose.prod.yml up -d"
echo "  6. Start Caddy: sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl restart caddy"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo "  Logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Rebuild:  git pull && docker compose -f docker-compose.prod.yml up -d --build"
echo "  Stop:     docker compose -f docker-compose.prod.yml down"
echo ""
