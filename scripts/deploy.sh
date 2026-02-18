#!/usr/bin/env bash
set -euo pipefail

# ── attestfor.me production deploy script ───────────────────────────
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/AideTechBot/attestfor.me/main/scripts/deploy.sh | bash -s -- <domain>
#
# Example:
#   curl -fsSL https://raw.githubusercontent.com/AideTechBot/attestfor.me/main/scripts/deploy.sh | bash -s -- attestfor.me

SCRIPT_VERSION="2026-02-18a"
REPO_RAW="https://raw.githubusercontent.com/AideTechBot/attestfor.me/main"
INSTALL_DIR="$HOME/attestfor.me"

# ── Parse args ──────────────────────────────────────────────────────
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: deploy.sh <domain>"
  echo "  e.g. deploy.sh attestfor.me"
  exit 1
fi

echo "==> attestfor.me deploy script v${SCRIPT_VERSION}"
echo "==> Deploying for domain: $DOMAIN"

# ── Check prerequisites ────────────────────────────────────────────
for cmd in docker curl openssl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed."
    exit 1
  fi
done

if ! docker compose version &>/dev/null; then
  echo "Error: 'docker compose' (v2) is required but not available."
  exit 1
fi

# ── Create install directory ────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "==> Downloading docker-compose.yml and Caddyfile..."
curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/Caddyfile" -o Caddyfile

# ── Generate .env (preserve existing secrets if present) ────────────
load_or_generate() {
  local key="$1"
  if [ -f .env ] && grep -q "^${key}=" .env; then
    grep "^${key}=" .env | cut -d= -f2-
  else
    openssl rand -hex 32
  fi
}

COOKIE_SECRET=$(load_or_generate COOKIE_SECRET)
UMAMI_APP_SECRET=$(load_or_generate UMAMI_APP_SECRET)
UMAMI_DB_PASSWORD=$(load_or_generate UMAMI_DB_PASSWORD)

install -m 600 /dev/null .env.tmp
cat > .env.tmp <<EOF
DOMAIN=$DOMAIN
COOKIE_SECRET=$COOKIE_SECRET
UMAMI_APP_SECRET=$UMAMI_APP_SECRET
UMAMI_DB_PASSWORD=$UMAMI_DB_PASSWORD
EOF
mv .env.tmp .env

echo "==> .env written to $INSTALL_DIR/.env (mode 600)"

# ── Pull latest images and start ────────────────────────────────────
echo "==> Pulling latest images..."
docker compose pull

echo "==> Starting services..."
docker compose up -d

# ── Auto-provision Umami ────────────────────────────────────────────
UMAMI_WEBSITE_ID=$(load_or_generate UMAMI_WEBSITE_ID)
UMAMI_ADMIN_PASSWORD=$(load_or_generate UMAMI_ADMIN_PASSWORD)

# Helper: hit the Umami API directly on localhost:3001 (published port, no TLS needed)
# Usage: umami_fetch METHOD PATH [BODY] [TOKEN]
umami_fetch() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local -a args=( -sf -X "$method" )
  if [ -n "$body" ]; then
    args+=( -H 'Content-Type: application/json' -d "$body" )
  fi
  if [ -n "$token" ]; then
    args+=( -H "Authorization: Bearer $token" )
  fi
  curl "${args[@]}" "http://127.0.0.1:3001${path}"
}

# Only run provisioning if UMAMI_WEBSITE_ID looks unset (a 64-char hex = freshly generated, not a UUID)
if [[ ${#UMAMI_WEBSITE_ID} -ne 36 ]]; then
  UMAMI_HEARTBEAT_URL="http://127.0.0.1:3001/api/heartbeat"
  echo "==> Waiting for Umami to be ready (direct on localhost:3001)..."
  UMAMI_READY=false
  for i in $(seq 1 60); do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$UMAMI_HEARTBEAT_URL" 2>&1) || true
    if [ "$HTTP_CODE" = "200" ]; then
      echo "    ✓ Umami ready (attempt $i)"
      UMAMI_READY=true
      break
    fi
    echo "    attempt $i/60 — HTTP $HTTP_CODE (retrying in 2s)"
    sleep 2
  done

  if [ "$UMAMI_READY" = false ]; then
    echo "⚠️  Umami did not become ready after 2 minutes. Skipping auto-provisioning."
    echo "   Provision manually at https://analytics.$DOMAIN (admin / umami)"
    echo "   Then set UMAMI_WEBSITE_ID in $INSTALL_DIR/.env and run: docker compose up -d app"
    UMAMI_WEBSITE_ID=""
    UMAMI_ADMIN_PASSWORD=""
  else
    echo "==> Provisioning Umami (changing password, creating website)..."

    # Login with default credentials
    LOGIN_RESPONSE=$(umami_fetch POST /api/auth/login '{"username":"admin","password":"umami"}' 2>/dev/null || true)

    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$TOKEN" ]; then
      # Change admin password
      NEW_PASS=$(openssl rand -base64 24)
      umami_fetch POST "/api/users/$USER_ID" "{\"password\":\"$NEW_PASS\"}" "$TOKEN" >/dev/null 2>&1 || true

      UMAMI_ADMIN_PASSWORD="$NEW_PASS"

      # Create website
      WEBSITE_RESPONSE=$(umami_fetch POST /api/websites "{\"name\":\"$DOMAIN\",\"domain\":\"$DOMAIN\"}" "$TOKEN" 2>/dev/null || true)

      UMAMI_WEBSITE_ID=$(echo "$WEBSITE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

      if [ -n "$UMAMI_WEBSITE_ID" ]; then
        echo "==> Umami website created with ID: $UMAMI_WEBSITE_ID"
      else
        echo "⚠️  Could not create Umami website automatically. Set UMAMI_WEBSITE_ID in .env manually."
        UMAMI_WEBSITE_ID=""
      fi
    else
      echo "⚠️  Could not log into Umami (may already be provisioned). Skipping auto-setup."
    fi
  fi
fi

# ── Rewrite .env with all values ────────────────────────────────────
install -m 600 /dev/null .env.tmp
cat > .env.tmp <<EOF
DOMAIN=$DOMAIN
COOKIE_SECRET=$COOKIE_SECRET
UMAMI_APP_SECRET=$UMAMI_APP_SECRET
UMAMI_DB_PASSWORD=$UMAMI_DB_PASSWORD
UMAMI_WEBSITE_ID=$UMAMI_WEBSITE_ID
UMAMI_ADMIN_PASSWORD=$UMAMI_ADMIN_PASSWORD
EOF
mv .env.tmp .env

# Restart app so it picks up the website ID
docker compose up -d app

echo ""
echo "✅ Done! attestfor.me is live at https://$DOMAIN"
echo ""
echo "   Caddy will automatically obtain HTTPS certificates."
echo "   Make sure DNS for both $DOMAIN and analytics.$DOMAIN point to this server."
echo ""
echo "   📊 Umami analytics: https://analytics.$DOMAIN"
echo "      Username: admin"
echo "      Password: $UMAMI_ADMIN_PASSWORD"
echo "      (saved in $INSTALL_DIR/.env)"
echo ""
echo "   Useful commands:"
echo "     cd $INSTALL_DIR"
echo "     docker compose logs -f        # watch logs"
echo "     docker compose logs caddy     # check TLS cert status"
echo "     docker compose pull && docker compose up -d  # update"
echo ""
echo "   To redeploy cleanly (preserves TLS certs to avoid Let's Encrypt rate limits):"
echo "     docker compose down && docker volume rm attestfor.me_redis-data attestfor.me_umami-db-data"
echo "     rm -rf $INSTALL_DIR"
echo "     # then re-run this deploy script"
echo ""
echo "   ⚠️  Do NOT remove the caddy-data volume — it holds your TLS certs."
echo "      Let's Encrypt rate-limits to 5 certs per domain per 7 days."
echo "     docker compose down           # stop (keeps all data)"
