# Deployment Guide

## Production Setup

### Prerequisites

1. A domain name (e.g., `attestfor.me`)
2. SSL certificate (Let's Encrypt with Caddy/nginx recommended)
3. Docker and Docker Compose installed

### Configuration

#### 1. Update OAuth Client Metadata

For production, you need to host the OAuth metadata at your production domain:

```bash
pnpm update-oauth-url https://your-domain.com
```

This updates `public/oauth/client-metadata.json` with your production URLs.

#### 2. Set Environment Variables

Create a `.env.production` file (or use your hosting platform's env var system):

```bash
# Your production domain
APP_URL=https://your-domain.com

# Generate a secure random secret
COOKIE_SECRET=$(openssl rand -hex 32)

# Redis URL (required for production)
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=production
PORT=3000
```

**Important:** Never commit `.env.production` with real secrets!

#### 3. Session Storage

The app automatically uses:
- **Development**: In-memory storage (no Redis needed)
- **Production**: Redis (when `NODE_ENV=production` and `REDIS_URL` is set)

All three session stores are handled:
- User sessions (cookie ID → DID)
- OAuth sessions (DID → tokens)
- OAuth state (PKCE verifiers)

No code changes needed—just set `REDIS_URL` in production.

### Docker Deployment

#### Build and Run

```bash
# Build the image
docker build -t attestfor-me .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e APP_URL=https://your-domain.com \
  -e COOKIE_SECRET=your-secure-secret \
  -e REDIS_URL=redis://redis:6379 \
  -e NODE_ENV=production \
  attestfor-me
```

#### Using Docker Compose

```bash
# Set your COOKIE_SECRET in environment or .env.production
export COOKIE_SECRET=$(openssl rand -hex 32)

# Start the service
docker-compose up -d
```

### Reverse Proxy (Recommended)

Use Caddy or nginx to handle SSL termination:

**Caddy (Caddyfile):**

```
attestfor.me {
    reverse_proxy localhost:3000
}
```

**nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name attestfor.me;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Checklist

- [ ] Update OAuth metadata with production domain
- [ ] Generate secure `COOKIE_SECRET`
- [ ] Set up Redis (included in docker-compose.yml)
- [ ] Set `REDIS_URL` environment variable
- [ ] Set up SSL certificate
- [ ] Configure reverse proxy
- [ ] Test OAuth flow on production domain
- [ ] Set up monitoring and logging
- [ ] Configure automated Redis backups

### Security Notes

1. **Cookie Settings**: The app already uses `httpOnly: true`, `secure: true`, `sameSite: 'lax'` - perfect for production
2. **HTTPS Required**: OAuth requires HTTPS in production
3. **Session Storage**: File-based storage doesn't scale and isn't safe across multiple containers
4. **Secrets**: Never commit `.env.production` or hardcode secrets
