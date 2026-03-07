# AGENTS.md

Guidelines for AI agents working on this codebase.

## Important Rules

- **Never ask to start the dev server** -assume it's already running. The user manages the server themselves.
- **Never ask to run tests after changes** -run them yourself if you need to verify.
- **Don't create documentation files** unless explicitly requested.
- **Search for existing utilities first** - before creating new helpers, search the codebase. Many common patterns already have implementations. Don't reinvent the wheel.
- **No em dashes** - use regular hyphens or commas instead.

## Project Overview

attestfor.me is a decentralized identity verification service built on AT Protocol (Bluesky). Users can link social accounts, domains, and cryptographic keys to their Bluesky DID and verify ownership through cryptographic proofs.

## Tech Stack

- **Frontend**: React 19, React Router 7, TanStack Query, Tailwind CSS 4
- **Backend**: Fastify 5, AT Protocol OAuth (@atcute packages)
- **Verification**: @keytrace/runner (client-side claim verification)
- **Storage**: Redis (production) / in-memory (development)
- **Build**: Vite 7, TypeScript 5.9

## Key Concepts

### Claims vs Proofs
The codebase uses "claims" (not "proofs"). A claim is a user's assertion of identity ownership stored in AT Protocol.

### Keytrace Integration
Claims are verified using the [@keytrace/runner](https://github.com/pkreissel/keytrace) library. The runner fetches proof content from external services and validates the cryptographic signature.

### Key Retraction
Keys can be "retracted" (not "revoked"). A retracted key has a `retractedAt` timestamp set. Check `key.value.retractedAt` to determine if a key is retracted.

## Architecture

### Server Routes (`server/routes/`)
- `repo-proxy.ts` - Proxies AT Protocol repo operations (createRecord, deleteRecord, putRecord)
- `fetch-proxy.ts` - CORS proxy for external APIs (GitHub, Twitter, etc.)
- `dns-lookup.ts` - Server-side DNS TXT record lookup
- `twitter-proxy.ts` - Twitter/X GraphQL API proxy

### Client Libraries (`src/lib/`)
- `atproto.ts` - AT Protocol operations (createRecord, deleteRecord, putRecord, retractKey)
- `run-verification.ts` - Runs @keytrace/runner verification with custom fetch
- `bsky.ts` - Bluesky API helpers (getProfile, resolveHandle)

### Components (`src/components/Profile/`)
- `AddClaimWizard.tsx` - Multi-step wizard for adding claims
- `SimpleClaimCard.tsx` / `DetailedClaimCard.tsx` - Claim display components
- `EditKeyList.tsx` / `EditClaimList.tsx` - Edit mode list components

## Important Patterns

### OAuth Session Caching
OAuth sessions are cached for 1 minute in `server/oauth.ts` via `restoreSession()`. Always use `restoreSession(did)` instead of `oauthClient.restore(did)` to avoid slow DID resolution on every request.

### Proxy Security
All proxy endpoints (`fetch-proxy.ts`, `dns-lookup.ts`, `twitter-proxy.ts`) use shared utilities from `proxy-utils.ts`:
- Rate limiting per IP
- SSRF protection (blocks private/internal IPs)
- URL validation (no credentials, restricted ports)
- Domain allowlisting

### DNS Verification
DNS claims cannot be verified client-side (browser can't do DNS lookups). The `verifyDnsViaServer()` function in `run-verification.ts` calls `/api/dns` to verify DNS TXT records server-side.

## Existing Utilities

**Always search these files before creating new helpers.**

### Server Utilities (`server/`)

| File | Contents |
|------|----------|
| `routes/proxy-utils.ts` | `checkRateLimit()`, `getClientIp()`, `isPrivateHost()`, `validateProxyUrl()`, `isValidDomain()` -shared security utilities for all proxy endpoints |
| `storage.ts` | `store.get()`, `store.set()`, `store.del()` -Redis/in-memory key-value storage |
| `oauth.ts` | `restoreSession()`, `getSession()`, `setSession()` -OAuth session management |
| `cache-ttl.ts` | Cache TTL constants |

### Client Utilities (`src/lib/`)

| File | Contents |
|------|----------|
| `utils.ts` | `cn()` -Tailwind class name merger (clsx + tailwind-merge) |
| `constants.ts` | `SESSION_COOKIE_NAME` and other shared constants |
| `global-features.ts` | `SERVICE_NAMES`, `KEY_TYPE_LABELS` -display labels for services and key types |
| `atproto.ts` | `createRecord()`, `deleteRecord()`, `putRecord()`, `retractKey()`, `parseAtUri()` -AT Protocol operations |
| `bsky.ts` | `getProfile()`, `resolveHandle()`, `listRecords()` -Bluesky API helpers |
| `proxied-fetch.ts` | `proxiedFetch()` -fetch wrapper that routes through server proxy for CORS |
| `run-verification.ts` | `runVerification()`, `verifyDnsViaServer()` -claim verification using @keytrace/runner |
| `key-parser.ts` | `parsePublicKey()` -parses PGP/SSH public keys |
| `claim-status-label.ts` | `getClaimStatusLabel()` -human-readable status text |
| `claim-border-colour.ts` | `getClaimBorderColour()` -status-based border colors |
| `error-handler.ts` | Error handling utilities |
| `hooks.ts` | Shared React hooks |
| `ui-strings.ts` | **All user-facing text** - buttons, labels, errors, messages. Always use this for new strings. |

## Testing

```bash
pnpm test        # Run tests once
pnpm test:watch  # Watch mode
```

Tests use Vitest. Test files are colocated with source files (`*.test.ts`).

## Common Tasks

### Adding a New Claim Type
1. Add service config to `src/lib/global-features.ts` (SERVICE_NAMES)
2. Add icon to `src/components/Profile/ServiceIcon.tsx`
3. If proxy needed, add host to allowlist in `server/routes/fetch-proxy.ts`

### Adding a New API Endpoint
1. Create route file in `server/routes/`
2. Register in `server/app-setup.ts`
3. Add client function in `src/lib/atproto.ts` if needed

## Files to Avoid Modifying

- `public/oauth/client-metadata.json` - OAuth client config (update APP_URL in .env instead)
- `types/keytrace.ts` - Generated from @keytrace/lexicon (Unless we explicitely are updating the lexicon)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_URL` | Yes | Public URL of the app |
| `COOKIE_SECRET` | Yes | Secret for session cookies |
| `REDIS_URL` | Prod only | Redis connection URL |
