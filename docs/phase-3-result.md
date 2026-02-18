# Phase 3 Implementation Results

**Date**: 2026-02-17  
**Status**: ✅ COMPLETE

## Overview

Phase 3 implemented authenticated AT Proto writes (the critical gap from Phase 2), client-side key parsing and upload for PGP/SSH keys, and an in-browser PGP sign & verify tool. It also added Fastify JSON Schema validation and typed generics across all server endpoints, eliminating unsafe `as` casts.

## Design Changes from Original Plan

### Lexicon as Source of Truth

The original Phase 3 plan proposed expanding `me.attest.key` `knownValues` to include `ssh-rsa`, `age`, `minisign`, `signify`, and `wireguard`. This was reverted — the lexicon is the source of truth, and only the 3 original key types are supported:
- `pgp`
- `ssh-ed25519`
- `ssh-ecdsa`

All parsers, tests, and UI labels are scoped to these 3 types only.

### Server-Side Schema Validation

The plan used `req.body as { ... }` casts for request typing. These were replaced with:
1. **Fastify JSON Schema validation** — `schema: { body: { ... } }` / `schema: { querystring: { ... } }` on every route, so Fastify validates before the handler runs
2. **Fastify typed generics** — `app.post<{ Body: T }>()` / `app.get<{ Querystring: T }>()` for compile-time type safety on `req.body` / `req.query`
3. **Runtime type guards** — `isDid()` and `isCollection()` validate format and narrow types, replacing unsafe `as Did` / `as \`...\`` casts
4. **Typed `SessionData.did`** — Changed from `string` to `Did` (`` `did:${string}:${string}` ``), so the DID flows through the type system without any casts

This was applied retroactively to **all** server endpoints, not just the new repo-proxy routes.

## Deliverables

### ✅ 1. Authenticated Write Proxy (`server/routes/repo-proxy.ts`)

Two generic proxy endpoints that authenticate via session cookie and forward writes to the user's PDS:

- **`POST /api/repo/createRecord`** — Creates a record in the user's AT Proto repo
  - Body schema: `{ collection: string (required), record: object (required), rkey?: string }`
  - Returns: `{ uri: string, cid: string }`
- **`POST /api/repo/deleteRecord`** — Deletes a record from the user's AT Proto repo
  - Body schema: `{ collection: string (required), rkey: string (required) }`
  - Returns: `{ success: true }`

**Validation layers:**
1. Fastify JSON Schema rejects malformed bodies (wrong types, missing required fields, extra properties) before the handler runs
2. Session cookie authentication (`401` if missing/expired)
3. `isDid()` type guard validates DID format via regex (`/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/`)
4. `isCollection()` type guard validates NSID format via regex (`/^[a-zA-Z]...\.[a-zA-Z]...\.[a-zA-Z]...$/`)

**Architecture:** These routes unblock all record creation across the app — keys, proofs, and future statements — without any collection-specific business logic.

**Registration:** `server/app-setup.ts` calls `registerRepoProxy(app)` after the Twitter proxy.

**Test Coverage**: 12 tests (auth, validation, proxy correctness, error handling)

### ✅ 2. Client-Side Write Helpers (`src/lib/atproto.ts`)

Added authenticated write functions that call the server proxy endpoints, complementing the existing public read functions:

- **`createRecord(collection, record, rkey?)`** — POST to `/api/repo/createRecord` with `credentials: "include"`
- **`deleteRecord(collection, rkey)`** — POST to `/api/repo/deleteRecord` with `credentials: "include"`
- **`publishKey(record)`** — Convenience wrapper for `createRecord("me.attest.key", ...)`
- **`deleteKey(rkey)`** — Convenience wrapper for `deleteRecord("me.attest.key", ...)`
- **`publishProof(record)`** — Convenience wrapper for `createRecord("me.attest.proof", ...)` — fills the Phase 2 gap
- **`deleteProof(rkey)`** — Convenience wrapper for `deleteRecord("me.attest.proof", ...)`
- **`listKeys(did)`** — Public read: list all `me.attest.key` records for a DID
- **`getKey(did, rkey)`** — Public read: get a single key record

### ✅ 3. Key Parser (`src/lib/key-parser.ts`)

Client-side key parsing using Web Crypto API and openpgp:

- **`parsePGPKey(armoredKey)`** — Parses PGP public key blocks via openpgp, extracts fingerprint (hex uppercase), expiration, user ID comment, algorithm
- **`parseSSHKey(sshKey)`** — Parses SSH public key lines, validates algorithm (`ssh-ed25519`, `ecdsa-sha2-nistp{256,384,521}`), computes SHA256 fingerprint via Web Crypto, extracts comment
- **`parseKey(keyData)`** — Auto-detects key type from content and delegates to the correct parser
- **`sha256Fingerprint(data)`** — Computes `SHA256:<base64>` fingerprint using `crypto.subtle.digest()` (browser-compatible)

**Supported key types** (from lexicon `knownValues`):
| keyType | Algorithms |
|---------|-----------|
| `pgp` | Any PGP public key |
| `ssh-ed25519` | `ssh-ed25519` |
| `ssh-ecdsa` | `ecdsa-sha2-nistp256`, `ecdsa-sha2-nistp384`, `ecdsa-sha2-nistp521` |

**Test Coverage**: 11 tests (PGP parsing, SSH ed25519/ECDSA, fingerprinting, auto-detection, error cases)

### ✅ 4. Key Upload Component (`src/components/KeyUpload.tsx`)

Full key upload UI with auto-detection:

- **Textarea input** — Paste any supported public key
- **File upload** — `.pub`, `.asc`, `.key`, `.txt` file picker
- **Auto-detection** — Parses on input change, shows detected type, fingerprint, algorithm, comment, expiration
- **Label field** — Optional user-defined label (e.g., "work laptop")
- **Publish** — Calls `publishKey()` to write an `me.attest.key` record to the user's AT Proto repo
- **Error display** — Shows parse errors and upload failures
- **Key type labels**: PGP / GPG, SSH Ed25519, SSH ECDSA

### ✅ 5. PGP Sign & Verify Page (`src/pages/SignVerifyPage.tsx`)

Tabbed page at `/sign-verify` with two forms — all cryptographic operations run entirely in the browser via openpgp.

#### Sign Tab (`src/components/SignVerify/SignForm.tsx`)
- **Message input** — Free-text message to sign
- **Private key input** — ASCII-armored PGP private key (never sent to server)
- **Passphrase input** — For encrypted keys, with show/hide toggle
- **Output** — PGP cleartext-signed message with copy-to-clipboard
- **Privacy indicator** — "Your private key never leaves your browser"

#### Verify Tab (`src/components/SignVerify/VerifyForm.tsx`)
- **Signed message input** — Paste a PGP cleartext-signed message
- **Key source selector** — Toggle between "Paste Public Key" and "Look Up Identity"
- **Paste mode** — Paste an ASCII-armored PGP public key directly
- **Lookup mode** — Enter a DID or handle → resolves handle via Bluesky API → fetches published PGP keys from the signer's AT Proto repo → uses the first active PGP key
- **Result display** — ✅ Valid / ❌ Invalid signature, with fingerprint and signer name

### ✅ 6. Server-Wide Schema Validation

Applied Fastify JSON Schema validation and typed generics to all existing endpoints (not just Phase 3):

| Endpoint | Schema | Changes |
|----------|--------|---------|
| `GET /api/auth/login` | `querystring: { handle?: string, returnTo?: string }` | Removed `req.query as { ... }` casts |
| `GET /api/auth/logout` | `querystring: { returnTo?: string }` | Removed `req.query as { ... }` cast |
| `GET /api/auth/session` | (no input) | Removed `sessionData.did as \`did:...\`` cast — `Did` type flows from `SessionData` |
| `GET /api/twitter/tweet` | `querystring: { tweetId: string (required), pattern: "^\d+$" }` | Moved tweetId validation from handler to schema |
| `POST /api/repo/createRecord` | `body: { collection (required), record (required), rkey? }` | New route with schema from the start |
| `POST /api/repo/deleteRecord` | `body: { collection (required), rkey (required) }` | New route with schema from the start |

**Typed `SessionData`**: Changed `did: string` to `did: Did` in `server/oauth.ts`, eliminating all downstream casts.

## Test Suite

**Total Tests**: 72 passing (0 failed)

| Test File | Tests | Description |
|-----------|-------|-------------|
| `src/lib/verifiers/twitter.test.ts` | 25 | Twitter proof verification (from Phase 2) |
| `src/lib/verifiers/github.test.ts` | 19 | GitHub proof verification (from Phase 2) |
| `server/routes/repo-proxy.test.ts` | 12 | Auth, validation, proxy correctness, error handling |
| `src/lib/key-parser.test.ts` | 11 | PGP/SSH parsing, fingerprinting, auto-detection |
| `src/lib/challenge.test.ts` | 5 | Nonce generation, challenge formatting (from Phase 2) |

**Test strategy**: All tests mock external dependencies (fetch, `@atcute/client`, oauth module). Repo-proxy tests use a mock Fastify harness that captures registered route handlers.

## File Structure (New/Modified)

```
server/
  ├── oauth.ts                          # Modified: SessionData.did typed as Did
  ├── app-setup.ts                      # Modified: schema validation on all routes
  └── routes/
      ├── repo-proxy.ts                 # NEW: authenticated write proxy
      ├── repo-proxy.test.ts            # NEW: 12 tests
      └── twitter-proxy.ts             # Modified: removed redundant manual validation

src/
  ├── routes.tsx                        # Modified: added /sign-verify route
  ├── lib/
  │   ├── atproto.ts                    # Modified: added write helpers + key/proof helpers
  │   ├── key-parser.ts                 # NEW: PGP/SSH key parsing
  │   └── key-parser.test.ts            # NEW: 11 tests
  ├── components/
  │   ├── KeyUpload.tsx                 # NEW: key upload with auto-detect
  │   └── SignVerify/
  │       ├── SignForm.tsx              # NEW: PGP cleartext signing
  │       └── VerifyForm.tsx            # NEW: PGP signature verification
  └── pages/
      └── SignVerifyPage.tsx            # NEW: tabbed sign/verify page
```

## Dependencies

No new dependencies were added. Phase 3 uses:
- **openpgp** (already in deps from Phase 2 planning) — PGP key parsing, signing, verification
- **Web Crypto API** (`crypto.subtle.digest`) — SSH key fingerprinting
- **Fastify built-in JSON Schema** (via Ajv, bundled with Fastify) — request validation

## Known Limitations

1. **Sign & Verify is PGP-only** — SSH keys can be uploaded and published, but signing/verification requires PGP. SSH signature verification could be added in a future phase.
2. **No key revocation UI** — Keys can be deleted via `deleteKey()`, but there's no revocation UI component yet (deferred to Phase 4 profile UI).
3. **No key list display** — `listKeys()` exists but no component renders a user's published keys yet (Phase 4).
4. **Single PGP key for lookup** — Verify form's identity lookup uses the first active PGP key found. If a user has multiple PGP keys, there's no key selector.
5. **No proof creation UI** — `publishProof()` is wired up but no proof creation wizard exists yet — the flow still needs to be connected end-to-end.

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| Authenticated writes via server proxy | ✅ | Two generic endpoints, session cookie auth |
| Fastify schema validation on all routes | ✅ | JSON Schema + typed generics, no `as` casts |
| Client-side key parsing (PGP, SSH) | ✅ | Auto-detect, fingerprinting via Web Crypto |
| Key upload component | ✅ | File upload, auto-detect, publish to repo |
| PGP sign tool (browser-only) | ✅ | Private key never leaves browser |
| PGP verify tool with identity lookup | ✅ | Resolve handle → fetch keys → verify |
| Lexicon unchanged | ✅ | Only pgp, ssh-ed25519, ssh-ecdsa |
| All tests passing | ✅ | 72 tests, 0 failures |
| TypeScript strict mode | ✅ | 0 type errors |
| ESLint clean | ✅ | 0 lint errors |
