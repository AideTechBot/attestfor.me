# OAuth Setup with VS Code Port Forwarding

## Overview

The production server includes AT Protocol OAuth authentication for Bluesky login. Since OAuth requires HTTPS, use VS Code's port forwarding to create a secure tunnel.

**Server Modes:**

- **Dev server** (`pnpm dev`) → Port 3000 → No OAuth → Fast development
- **Production server** (`pnpm start`) → Port 3001 → OAuth enabled → Full features

## Quick Start Guide

### 1. Build Production Files

```bash
pnpm build
```

### 2. Start Production Server

```bash
PORT=3001 pnpm start
```

### 3. Create VS Code Tunnel

1. Open **Ports** panel (`Cmd/Ctrl+J` → PORTS tab)
2. Click **Forward a Port** → Enter `3001`
3. Right-click port 3001 → **Port Visibility** → **Public**
4. Copy the **Forwarded Address** (e.g., `https://abc123-3001.app.github.dev`)

### 4. Configure OAuth with Your Tunnel URL

```bash
# Set your actual tunnel URL
export VSCODE_TUNNEL_URL=https://your-actual-tunnel-url.app.github.dev

# Rebuild server code
pnpm run build:server:ts

# Restart server
lsof -ti:3001 | xargs kill -9
PORT=3001 pnpm start
```

### 5. Test OAuth

1. Open your tunnel URL in a browser
2. Click the avatar icon
3. Enter your Bluesky handle (e.g., `alice.bsky.social`)
4. Sign in with Bluesky
5. Your avatar should appear!

## Configuration Details

### Environment Variable Method (Recommended)

Set the `VSCODE_TUNNEL_URL` environment variable before starting:

```bash
export VSCODE_TUNNEL_URL=https://your-tunnel.app.github.dev
pnpm run build:server:ts
PORT=3001 pnpm start
```

### Manual File Edit Method

If you prefer to hardcode the URL, edit these files:

**File 1: `server/oauth.ts`** (line 7)

```typescript
const TUNNEL_URL =
  process.env.VSCODE_TUNNEL_URL || "https://your-tunnel.app.github.dev";
```

**File 2: `public/oauth/client-metadata.json`**

```json
{
  "client_id": "https://your-tunnel.app.github.dev/oauth/client-metadata.json",
  "client_uri": "https://your-tunnel.app.github.dev",
  "redirect_uris": ["https://your-tunnel.app.github.dev/api/auth/callback"],
  ...
}
```

After editing, rebuild:

```bash
pnpm run build:server:ts
```

## Features Available After Login

- **Avatar Display**: Your Bluesky avatar appears in the header dropdown
- **Profile Pages**: Navigate to `/@handle` to view any Bluesky user profile
- **Session Persistence**: Login persists for 30 days via cookies
- **Sign Out**: Click your avatar → Sign out

## Development Workflow

### UI Development (Fast, No OAuth)

```bash
pnpm dev
# Access at http://localhost:3000
```

### OAuth Testing (Full Features)

```bash
# Start production server with tunnel
export VSCODE_TUNNEL_URL=https://your-tunnel.app.github.dev
PORT=3001 pnpm start

# In another terminal, make code changes then:
pnpm run build:server:ts
lsof -ti:3001 | xargs kill -9
PORT=3001 pnpm start
```

## Troubleshooting

### Error: "Domain name must contain at least two segments"

Your tunnel URL must have the format: `https://something.domain.tld`

✅ Correct: `https://abc-3001.app.github.dev`  
❌ Wrong: `https://localhost`  
❌ Wrong: `https://example`

### Error: "Invalid hostname" / "Unable to obtain client metadata"

This means Bluesky can't access your client metadata file. Check:

1. **Is the tunnel public?** Right-click port in VS Code → Port Visibility → Public
2. **Can you access it?** Try visiting `https://your-tunnel-url/oauth/client-metadata.json` in your browser
3. **Is the URL correct?** Both `server/oauth.ts` and `public/oauth/client-metadata.json` must use the same URL

### Port Already in Use

```bash
# Kill port 3001 (production)
lsof -ti:3001 | xargs kill -9

# Kill port 3000 (dev)
lsof -ti:3000 | xargs kill -9
```

### OAuth Redirect Fails / Callback Error

1. **Clear browser cookies** for your tunnel domain
2. **Check server logs** in the terminal running `pnpm start`
3. **Verify redirect URI** matches exactly in both config files
4. **Try incognito mode** to test with fresh cookies

### Tunnel URL Changed

VS Code tunnel URLs can change when you restart VS Code. If OAuth suddenly stops working:

1. Check your current tunnel URL in the Ports panel
2. Update `VSCODE_TUNNEL_URL` and rebuild:
   ```bash
   export VSCODE_TUNNEL_URL=https://new-tunnel-url.app.github.dev
   pnpm run build:server:ts
   lsof -ti:3001 | xargs kill -9
   PORT=3001 pnpm start
   ```

### "Client metadata must include the 'atproto' scope"

The code already includes this. If you see this error, make sure you haven't accidentally removed:

```json
"scope": "atproto transition:generic"
```

from `server/oauth.ts` clientMetadata and `public/oauth/client-metadata.json`.

## Technical Details

### Session Storage

- **Method**: File-based (`.sessions.json`)
- **Cookie**: `session` (httpOnly, sameSite: lax, 30 days)
- **Production**: Replace with Redis or database

### OAuth State Storage

- **Method**: In-memory (global object)
- **Warning**: Lost on server restart
- **Production**: Replace with Redis or database

### Profile Data

- **Source**: Bluesky public API
- **Endpoint**: `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile`
- **Auth**: Not required (public data)

### Architecture

```
Browser → VS Code Tunnel (HTTPS) → Local Server (port 3001)
                                  ↓
                            OAuth Flow
                                  ↓
                          Bluesky Authorization
                                  ↓
                         Callback & Session Storage
```

## Security Notes

- **Dev environment only**: File-based sessions are NOT secure for production
- **HTTPS required**: AT Protocol OAuth enforces HTTPS for security
- **Public tunnel**: Your tunnel URL will be accessible to anyone on the internet
- **Credentials**: Never commit `.sessions.json` to git (already in `.gitignore`)
- **Production deployment**: Use proper secrets management and session storage

## Next Steps for Production

When deploying to a real domain:

1. **Domain**: Use your own domain with HTTPS (e.g., `https://attestfor.me`)
2. **Session Store**: Migrate to Redis or PostgreSQL
3. **OAuth State**: Use Redis with TTL for state storage
4. **Environment Variables**: Use proper secrets management (e.g., Docker secrets, AWS Secrets Manager)
5. **Client Metadata**: Update `client_id`, `client_uri`, and `redirect_uris` to production URLs
6. **Rebuild**: `pnpm build` and deploy to your hosting platform

---

**Questions?** Check the [AT Protocol OAuth documentation](https://atproto.com/specs/oauth) for more details on the OAuth flow.
