# Phase 3: Public Keys + Sign & Verify — Implementation Guide

**Objective:** Implement authenticated AT Proto writes (the critical missing piece from Phase 2), client-side key parsing and upload for PGP/SSH/age/minisign/signify/WireGuard, and an in-browser PGP sign & verify tool.

**Prerequisites:**
- Phase 1 completed (lexicons, OAuth, server infrastructure)
- Phase 2 completed (client-side proof verification, Twitter proxy, client-side AT Proto reads)

---

## Architecture Principles (from Phase 2)

1. **Thin server** — The server only handles OAuth session management and proxies requests that the browser cannot make directly
2. **Client-side logic** — All parsing, validation, and verification runs in the browser
3. **Server as auth proxy** — The only reason to add server routes is when the browser lacks the credentials (DPoP keys + OAuth tokens live server-side)
4. **Public reads are client-side** — `src/lib/atproto.ts` already reads from the public Bluesky XRPC API with no auth

### Why Authenticated Writes Need the Server

The app uses `@atcute/oauth-node-client` for server-side OAuth. When a user logs in:

1. The DPoP key pair + access/refresh tokens are stored server-side in Redis/in-memory (`server/storage.ts`)
2. The browser only receives a session cookie (random UUID → DID mapping)
3. To write to the user's PDS, the server must call `oauthClient.restore(did)` to reconstruct the `OAuthSession` with the stored DPoP key, then make DPoP-signed XRPC calls

The browser cannot make authenticated PDS requests because it has no DPoP private key or access tokens.

---

## Task 3.1: Authenticated Write Proxy Routes

### Location
Create file: `server/routes/repo-proxy.ts`
Update file: `server/app-setup.ts` (register routes)

### Overview

Two generic, thin proxy endpoints that authenticate via session cookie and forward writes to the user's PDS. No business logic, no validation — just auth + proxy. This follows the same pattern as `server/routes/twitter-proxy.ts`.

These routes unblock **all** record creation across the app — keys (Phase 3), proofs (Phase 2 gap), and statements (future).

### Implementation: `server/routes/repo-proxy.ts`

```typescript
import type { FastifyInstance } from "fastify";
import { Client } from "@atcute/client";
import { oauthClient, getSession } from "../oauth";
import { SESSION_COOKIE_NAME } from "../../src/lib/constants";
import type { Did } from "@atcute/lexicons";

export async function registerRepoProxy(app: FastifyInstance) {
  /**
   * POST /api/repo/createRecord
   * Create a record in the authenticated user's AT Proto repository.
   *
   * Body: { collection: string, record: object, rkey?: string }
   * Returns: { uri: string, cid: string }
   */
  app.post("/api/repo/createRecord", async (req, res) => {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
      return res.status(401).send({ error: "Not authenticated" });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return res.status(401).send({ error: "Session expired" });
    }

    const { collection, record, rkey } = req.body as {
      collection: string;
      record: Record<string, unknown>;
      rkey?: string;
    };

    if (!collection || !record) {
      return res
        .status(400)
        .send({ error: "Missing required fields: collection, record" });
    }

    try {
      const session = await oauthClient.restore(sessionData.did as Did);
      const client = new Client({ handler: session });

      const result = await client.post("com.atproto.repo.createRecord", {
        input: {
          repo: sessionData.did,
          collection,
          rkey,
          record,
        },
      });

      return res.send({
        uri: result.data.uri,
        cid: result.data.cid,
      });
    } catch (error: unknown) {
      console.error("[repo-proxy] createRecord error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res
        .status(500)
        .send({ error: "Failed to create record", message });
    }
  });

  /**
   * POST /api/repo/deleteRecord
   * Delete a record from the authenticated user's AT Proto repository.
   *
   * Body: { collection: string, rkey: string }
   */
  app.post("/api/repo/deleteRecord", async (req, res) => {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
      return res.status(401).send({ error: "Not authenticated" });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return res.status(401).send({ error: "Session expired" });
    }

    const { collection, rkey } = req.body as {
      collection: string;
      rkey: string;
    };

    if (!collection || !rkey) {
      return res
        .status(400)
        .send({ error: "Missing required fields: collection, rkey" });
    }

    try {
      const session = await oauthClient.restore(sessionData.did as Did);
      const client = new Client({ handler: session });

      await client.post("com.atproto.repo.deleteRecord", {
        input: {
          repo: sessionData.did,
          collection,
          rkey,
        },
      });

      return res.send({ success: true });
    } catch (error: unknown) {
      console.error("[repo-proxy] deleteRecord error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res
        .status(500)
        .send({ error: "Failed to delete record", message });
    }
  });
}
```

### Registration in `server/app-setup.ts`

Add to the existing `setupApp` function, alongside the Twitter proxy registration:

```typescript
import { registerRepoProxy } from "./routes/repo-proxy";

// Inside setupApp(), after the Twitter proxy line:
await registerRepoProxy(app);
```

### Tests: `server/routes/repo-proxy.test.ts`

- Mock `oauthClient.restore()` to return a fake `OAuthSession`
- Mock `Client.post()` to capture XRPC calls
- Test: returns 401 when no session cookie
- Test: returns 401 when session expired
- Test: returns 400 when missing collection/record
- Test: proxies createRecord with correct repo/collection/record
- Test: proxies deleteRecord with correct repo/collection/rkey
- Test: returns 500 with error message on PDS failure

---

## Task 3.2: Client-Side Write Helpers

### Location
Update file: `src/lib/atproto.ts`

### Overview

Add client-side functions that call the server write proxy endpoints. These complement the existing public read functions in `src/lib/atproto.ts`.

### Implementation

Add to the existing `src/lib/atproto.ts`:

```typescript
// ── Authenticated writes (via server proxy) ────────────────────────

/**
 * Create a record in the authenticated user's repo.
 * Goes through the server proxy because OAuth tokens/DPoP keys are server-side.
 */
export async function createRecord(
  collection: string,
  record: Record<string, unknown>,
  rkey?: string,
): Promise<{ uri: string; cid: string }> {
  const response = await fetch("/api/repo/createRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ collection, record, rkey }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a record from the authenticated user's repo.
 * Goes through the server proxy because OAuth tokens/DPoP keys are server-side.
 */
export async function deleteRecord(
  collection: string,
  rkey: string,
): Promise<void> {
  const response = await fetch("/api/repo/deleteRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ collection, rkey }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
}

// ── Key-specific helpers ───────────────────────────────────────────

import type { MeAttestKey } from "../../types/lexicons";

const KEY_COLLECTION = "me.attest.key";

/**
 * List all keys for a DID (public, no auth)
 */
export async function listKeys(
  did: string,
): Promise<AtProtoRecord<MeAttestKey.Main>[]> {
  const result = await listRecords<MeAttestKey.Main>(did, KEY_COLLECTION);
  return result.records;
}

/**
 * Get a single key by rkey (public, no auth)
 */
export async function getKey(
  did: string,
  rkey: string,
): Promise<AtProtoRecord<MeAttestKey.Main>> {
  return getRecord<MeAttestKey.Main>(did, KEY_COLLECTION, rkey);
}

/**
 * Publish a key to the authenticated user's repo (via server proxy)
 */
export async function publishKey(
  record: MeAttestKey.Main,
): Promise<{ uri: string; cid: string }> {
  return createRecord(
    KEY_COLLECTION,
    record as unknown as Record<string, unknown>,
  );
}

/**
 * Delete a key from the authenticated user's repo (via server proxy)
 */
export async function deleteKey(rkey: string): Promise<void> {
  return deleteRecord(KEY_COLLECTION, rkey);
}

/**
 * Publish a proof to the authenticated user's repo (via server proxy).
 * (Unblocks the Phase 2 gap — proof creation was not wired up)
 */
export async function publishProof(
  record: MeAttestProof.Main,
): Promise<{ uri: string; cid: string }> {
  return createRecord(
    PROOF_COLLECTION,
    record as unknown as Record<string, unknown>,
  );
}

/**
 * Delete a proof from the authenticated user's repo (via server proxy)
 */
export async function deleteProof(rkey: string): Promise<void> {
  return deleteRecord(PROOF_COLLECTION, rkey);
}
```

---

## Task 3.3: Client-Side Key Parser

### Location
Create file: `src/lib/key-parser.ts`

### Overview

Pure client-side key parsing and fingerprint extraction. No server involvement. Uses Web Crypto API (`crypto.subtle`) for SSH fingerprint hashing — **not** Node.js `crypto`. Uses `openpgp` (browser build) for PGP key parsing.

### Supported Key Types

From the `me.attest.key` lexicon `keyType` field:

| Type | `keyType` value | Fingerprint method |
|------|----------------|-------------------|
| PGP/GPG | `pgp` | 40-char hex via openpgp |
| SSH Ed25519 | `ssh-ed25519` | `SHA256:{base64}` via Web Crypto |
| SSH ECDSA | `ssh-ecdsa` | `SHA256:{base64}` via Web Crypto |
| SSH RSA | `ssh-rsa` | `SHA256:{base64}` via Web Crypto |
| age | `age` | The key itself (self-identifying) |
| minisign | `minisign` | First 12 chars of key data |
| signify | `signify` | First 16 chars of key data |
| WireGuard | `wireguard` | The key itself (44 base64 chars) |

### Implementation: `src/lib/key-parser.ts`

```typescript
import * as openpgp from "openpgp";

export interface ParsedKey {
  keyType: string;
  fingerprint: string;
  publicKey: string;
  comment?: string;
  expiresAt?: string;
  algorithm?: string;
}

/**
 * SHA256 fingerprint using Web Crypto API (browser-compatible).
 */
async function sha256Fingerprint(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `SHA256:${base64}`;
}

/**
 * Parse and extract fingerprint from a PGP public key.
 */
export async function parsePGPKey(armoredKey: string): Promise<ParsedKey> {
  const key = await openpgp.readKey({ armoredKey });

  const fingerprint = key.getFingerprint().toUpperCase();
  const expirationTime = await key.getExpirationTime();
  const expiresAt =
    expirationTime instanceof Date ? expirationTime.toISOString() : undefined;

  const user = await key.getPrimaryUser();
  const comment =
    user?.user?.userID?.name || user?.user?.userID?.email || undefined;

  return {
    keyType: "pgp",
    fingerprint,
    publicKey: armoredKey.trim(),
    comment,
    expiresAt,
    algorithm: key.getAlgorithmInfo().algorithm,
  };
}

/**
 * Parse and extract fingerprint from an SSH public key.
 */
export async function parseSSHKey(sshKey: string): Promise<ParsedKey> {
  const trimmed = sshKey.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length < 2) {
    throw new Error("Invalid SSH key format");
  }

  const [algorithm, keyData, ...commentParts] = parts;
  const comment = commentParts.join(" ") || undefined;

  const validAlgorithms = [
    "ssh-rsa",
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
  ];

  if (!validAlgorithms.includes(algorithm)) {
    throw new Error(`Unsupported SSH key algorithm: ${algorithm}`);
  }

  // Decode base64 key data and compute SHA256 fingerprint via Web Crypto
  const binaryString = atob(keyData);
  const keyBuffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBuffer[i] = binaryString.charCodeAt(i);
  }
  const fingerprint = await sha256Fingerprint(keyBuffer);

  // Map to keyType values matching the lexicon
  let keyType: string;
  if (algorithm === "ssh-rsa") {
    keyType = "ssh-rsa";
  } else if (algorithm === "ssh-ed25519") {
    keyType = "ssh-ed25519";
  } else {
    keyType = "ssh-ecdsa";
  }

  return {
    keyType,
    fingerprint,
    publicKey: trimmed,
    comment,
    algorithm,
  };
}

/**
 * Parse an age public key.
 */
export function parseAgeKey(ageKey: string): ParsedKey {
  const trimmed = ageKey.trim();

  // age1 followed by 58 bech32 characters
  if (!/^age1[a-z0-9]{58}$/.test(trimmed)) {
    throw new Error("Invalid age key format");
  }

  return {
    keyType: "age",
    fingerprint: trimmed,
    publicKey: trimmed,
    algorithm: "X25519",
  };
}

/**
 * Parse a minisign public key.
 */
export function parseMinisignKey(minisignKey: string): ParsedKey {
  const lines = minisignKey.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Invalid minisign key format");
  }

  const keyLine = lines[lines.length - 1];
  if (!keyLine || keyLine.length < 40) {
    throw new Error("Invalid minisign key data");
  }

  return {
    keyType: "minisign",
    fingerprint: keyLine.substring(0, 12),
    publicKey: minisignKey.trim(),
    comment: lines[0].replace(/^untrusted comment:\s*/, ""),
    algorithm: "Ed25519",
  };
}

/**
 * Parse a signify public key (OpenBSD).
 */
export function parseSignifyKey(signifyKey: string): ParsedKey {
  const lines = signifyKey.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Invalid signify key format");
  }

  const keyData = lines[1];
  if (!keyData || keyData.length < 40) {
    throw new Error("Invalid signify key data");
  }

  return {
    keyType: "signify",
    fingerprint: keyData.substring(0, 16),
    publicKey: signifyKey.trim(),
    comment: lines[0].replace(/^untrusted comment:\s*/, ""),
    algorithm: "Ed25519",
  };
}

/**
 * Parse a WireGuard public key.
 */
export function parseWireGuardKey(wgKey: string): ParsedKey {
  const trimmed = wgKey.trim();

  // WireGuard key: 44 base64 characters (32 bytes = 43 chars + 1 padding)
  if (!/^[A-Za-z0-9+/]{42}[A-Za-z0-9+/=]{2}$/.test(trimmed)) {
    throw new Error("Invalid WireGuard key format");
  }

  return {
    keyType: "wireguard",
    fingerprint: trimmed,
    publicKey: trimmed,
    algorithm: "Curve25519",
  };
}

/**
 * Auto-detect and parse any supported key type.
 */
export async function parseKey(keyData: string): Promise<ParsedKey> {
  const trimmed = keyData.trim();

  if (trimmed.includes("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
    return parsePGPKey(trimmed);
  }
  if (trimmed.startsWith("ssh-") || trimmed.startsWith("ecdsa-")) {
    return parseSSHKey(trimmed);
  }
  if (trimmed.startsWith("age1")) {
    return parseAgeKey(trimmed);
  }
  if (trimmed.includes("untrusted comment") && trimmed.includes("minisign")) {
    return parseMinisignKey(trimmed);
  }
  if (trimmed.includes("untrusted comment")) {
    return parseSignifyKey(trimmed);
  }
  if (/^[A-Za-z0-9+/]{42}[A-Za-z0-9+/=]{2}$/.test(trimmed)) {
    return parseWireGuardKey(trimmed);
  }

  throw new Error(
    "Unknown key format. Supported: PGP, SSH, age, minisign, signify, WireGuard",
  );
}
```

### Dependencies

```bash
pnpm add openpgp
```

`openpgp` is a **client dependency** (it ships a browser-compatible build). It is used for:
- PGP key parsing and fingerprint extraction (Task 3.3)
- PGP message signing and signature verification (Task 3.6)

### Tests: `src/lib/key-parser.test.ts`

- Test `parseSSHKey` with ed25519, RSA, ECDSA keys
- Test `parseSSHKey` throws on invalid format
- Test `parsePGPKey` extracts fingerprint and comment (mock openpgp)
- Test `parseAgeKey` with valid key and rejects invalid
- Test `parseMinisignKey` extracts comment and fingerprint
- Test `parseSignifyKey` extracts comment and fingerprint
- Test `parseWireGuardKey` with valid 44-char key and rejects invalid
- Test `parseKey` auto-detects all supported types
- All tests mock `crypto.subtle.digest` for SSH fingerprinting (Web Crypto API)

---

## Task 3.4: Lexicon Update

### Location
Update file: `lexicons/me/attest/key.json`

### Change

Add missing key types to `knownValues`. The `keyType` field is a `string` (not an enum), so unknown values are already accepted — `knownValues` is just documentation of expected values.

```diff
  "knownValues": [
    "pgp",
    "ssh-ed25519",
-   "ssh-ecdsa"
+   "ssh-ecdsa",
+   "ssh-rsa",
+   "age",
+   "minisign",
+   "signify",
+   "wireguard"
  ]
```

After updating, regenerate types:

```bash
pnpm generate:types
```

---

## Task 3.5: Key Upload Component

### Location
Create file: `src/components/KeyUpload.tsx`

### Overview

Client-side component that:
1. Accepts a public key via paste or file upload
2. Auto-detects the key type using `parseKey()` from `src/lib/key-parser.ts`
3. Shows detected type and extracted fingerprint
4. Publishes the key to the user's AT Proto repo via `publishKey()` from `src/lib/atproto.ts`

All parsing runs in the browser. The only network call is the final `publishKey()` which goes through the server write proxy.

### Implementation sketch

```typescript
import { useState } from "react";
import { parseKey, type ParsedKey } from "@/lib/key-parser";
import { publishKey } from "@/lib/atproto";

interface KeyUploadProps {
  onSuccess: (uri: string, cid: string) => void;
}

export function KeyUpload({ onSuccess }: KeyUploadProps) {
  const [publicKey, setPublicKey] = useState("");
  const [label, setLabel] = useState("");
  const [parsed, setParsed] = useState<ParsedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleKeyChange = async (value: string) => {
    setPublicKey(value);
    setError(null);
    setParsed(null);

    if (!value.trim()) return;

    try {
      const result = await parseKey(value);
      setParsed(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid key");
    }
  };

  const handleSubmit = async () => {
    if (!parsed) return;
    setUploading(true);
    setError(null);

    try {
      const { uri, cid } = await publishKey({
        keyType: parsed.keyType,
        fingerprint: parsed.fingerprint,
        publicKey: parsed.publicKey,
        label: label || undefined,
        comment: parsed.comment,
        expiresAt: parsed.expiresAt,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      onSuccess(uri, cid);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await handleKeyChange(text);
  };

  // ... render form with textarea, file input, label input,
  //     detected type badge, fingerprint display, submit button
}
```

---

## Task 3.6: In-Browser PGP Sign & Verify

### Location
Create files:
- `src/pages/SignVerifyPage.tsx`
- `src/components/SignVerify/SignForm.tsx`
- `src/components/SignVerify/VerifyForm.tsx`

Update file: `src/routes.tsx` (add `/sign-verify` route)

### Overview

Entirely client-side PGP signing and verification using `openpgp`. The private key **never leaves the browser** and is **never sent to the server**.

### Sign Flow

1. User types a message
2. User pastes their PGP private key (+ passphrase if encrypted)
3. Client-side `openpgp.sign()` produces a cleartext-signed message
4. Output displayed for copying

### Verify Flow

1. User pastes a PGP cleartext-signed message
2. User provides or the app fetches the signer's public key:
   - Option A: Paste the public key manually
   - Option B: Enter a DID/handle → app calls `listKeys()` from `src/lib/atproto.ts` to fetch their published PGP keys (public read, no auth)
3. Client-side `openpgp.verify()` checks the signature
4. Result displayed: valid/invalid, signer info, fingerprint match

### Route Registration

Add to `src/routes.tsx`:

```typescript
import { SignVerifyPage } from "./pages/SignVerifyPage";

// In the routes array, inside the PageLayout children:
{
  path: "/sign-verify",
  element: <SignVerifyPage />,
}
```

### Implementation: `src/components/SignVerify/SignForm.tsx`

```typescript
import { useState } from "react";
import * as openpgp from "openpgp";

export function SignForm() {
  const [message, setMessage] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [signedMessage, setSignedMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    setSigning(true);
    setError(null);

    try {
      let key = await openpgp.readPrivateKey({ armoredKey: privateKey });
      if (key.isEncrypted()) {
        if (!passphrase)
          throw new Error("Key is encrypted — passphrase required");
        key = await openpgp.decryptKey({ privateKey: key, passphrase });
      }

      const signed = await openpgp.sign({
        message: await openpgp.createCleartextMessage({ text: message }),
        signingKeys: key,
      });

      setSignedMessage(signed as string);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setSigning(false);
    }
  };

  // ... render: message textarea, private key textarea,
  //     passphrase input, sign button, signed output + copy button
  //     Note: "Your private key never leaves your browser"
}
```

### Implementation: `src/components/SignVerify/VerifyForm.tsx`

```typescript
import { useState } from "react";
import * as openpgp from "openpgp";
import { listKeys } from "@/lib/atproto";

export function VerifyForm() {
  const [signedMessage, setSignedMessage] = useState("");
  const [publicKeyInput, setPublicKeyInput] = useState("");
  const [didInput, setDidInput] = useState("");
  const [result, setResult] = useState<{
    valid: boolean;
    fingerprint: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      let armoredPublicKey = publicKeyInput;

      // If DID/handle provided, fetch their PGP keys from AT Proto
      if (!armoredPublicKey && didInput) {
        const keys = await listKeys(didInput);
        const pgpKey = keys.find(
          (k) => k.value.keyType === "pgp" && k.value.status === "active",
        );
        if (!pgpKey)
          throw new Error("No active PGP key found for this identity");
        armoredPublicKey = pgpKey.value.publicKey;
      }

      if (!armoredPublicKey)
        throw new Error("Provide a public key or DID/handle");

      const publicKey = await openpgp.readKey({
        armoredKey: armoredPublicKey,
      });
      const message = await openpgp.readCleartextMessage({
        cleartextMessage: signedMessage,
      });

      const verification = await openpgp.verify({
        message,
        verificationKeys: publicKey,
      });

      const { verified } = verification.signatures[0];
      await verified; // throws if invalid

      setResult({
        valid: true,
        fingerprint: publicKey.getFingerprint().toUpperCase(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setResult(null);
    }
  };

  // ... render: signed message textarea, public key textarea OR did/handle input,
  //     verify button, result display (valid/invalid + fingerprint)
}
```

---

## Task Order & Dependencies

```
Task 3.1: Repo write proxy routes (server)
  └── Task 3.2: Client-side write helpers (depends on 3.1)
       └── Task 3.5: Key upload component (depends on 3.2, 3.3)

Task 3.3: Key parser library (client, independent)
Task 3.4: Lexicon update (independent)
Task 3.6: Sign & verify page (depends on 3.3 for openpgp dep, 3.2 for key reads)
```

Recommended implementation order: **3.4 → 3.1 → 3.2 → 3.3 → 3.5 → 3.6**

---

## File Structure (New/Modified)

```
server/
  ├── app-setup.ts                    # MODIFIED — register repo proxy routes
  └── routes/
      ├── twitter-proxy.ts            # existing
      └── repo-proxy.ts               # NEW — createRecord + deleteRecord proxy

src/
  ├── lib/
  │   ├── atproto.ts                  # MODIFIED — add write helpers + key/proof helpers
  │   ├── key-parser.ts               # NEW — client-side key parsing
  │   └── key-parser.test.ts          # NEW — tests
  ├── components/
  │   ├── KeyUpload.tsx               # NEW — key upload form
  │   └── SignVerify/
  │       ├── SignForm.tsx            # NEW — PGP signing
  │       └── VerifyForm.tsx          # NEW — PGP verification
  ├── pages/
  │   └── SignVerifyPage.tsx          # NEW — sign/verify page
  └── routes.tsx                      # MODIFIED — add /sign-verify route

lexicons/
  └── me/attest/key.json             # MODIFIED — add knownValues

types/lexicons/types/me/attest/
  └── key.ts                         # REGENERATED via pnpm generate:types
```

---

## Test Plan

| Test File | Location | Tests | Description |
|-----------|----------|-------|-------------|
| `server/routes/repo-proxy.test.ts` | server | ~6 | Auth validation, createRecord proxy, deleteRecord proxy, error handling |
| `src/lib/key-parser.test.ts` | client | ~15 | All key type parsing, auto-detection, fingerprint extraction, error cases |

**Existing tests** (49 passing from Phase 2) must continue to pass.

**Test strategy:**
- All tests mock `fetch` / `crypto.subtle` — no network calls
- Server tests mock `oauthClient.restore()` and `Client`
- Key parser tests mock `openpgp.readKey()` and `crypto.subtle.digest()`
- Vitest with `globals: true`

---

## Dependencies

### New

| Package | Type | Purpose |
|---------|------|---------|
| `openpgp` | runtime (client) | PGP key parsing, signing, verification |

### Existing (no changes)

| Package | Purpose |
|---------|---------|
| `@atcute/client` | XRPC client for authenticated PDS calls (server-side, via `Client` + `OAuthSession` handler) |
| `@atcute/oauth-node-client` | OAuth session management (server-side) |

---

## Acceptance Criteria

- [ ] `POST /api/repo/createRecord` creates records via authenticated DPoP-signed PDS requests
- [ ] `POST /api/repo/deleteRecord` deletes records via authenticated DPoP-signed PDS requests
- [ ] Both routes return 401 for unauthenticated requests
- [ ] Client-side `createRecord()` / `deleteRecord()` in `src/lib/atproto.ts` call the proxy
- [ ] Key parser supports all 7 key types (PGP, SSH Ed25519, SSH ECDSA, SSH RSA, age, minisign, signify, WireGuard)
- [ ] Key parser uses Web Crypto API (`crypto.subtle`) for SSH fingerprints — no Node.js `crypto`
- [ ] `parseKey()` auto-detects key type from content
- [ ] Key upload component parses client-side, publishes via `publishKey()`
- [ ] `me.attest.key` lexicon `knownValues` updated and types regenerated
- [ ] PGP sign form works entirely client-side — private key never sent to server
- [ ] PGP verify form can fetch signer's public key from AT Proto repo via `listKeys()`
- [ ] `/sign-verify` route registered
- [ ] All new tests pass
- [ ] All existing Phase 2 tests (49) still pass
- [ ] No TypeScript errors, build succeeds

---

## Known Limitations

1. **Only PGP signing/verifying** — SSH, age, minisign, signify, WireGuard signing is out of scope for Phase 3
2. **No key rotation** — Users can delete and re-upload, but there's no formal rotation ceremony
3. **No machine-facing key endpoints** — `GET /:handle.keys` for SSH/PGP (like GitHub) deferred to a later phase
4. **PGP private keys in browser** — Users must paste their private key into a textarea; no browser extension or hardware key integration yet (Phase 6)
5. **openpgp bundle size** — `openpgp` is ~200KB gzipped; consider lazy-loading the sign/verify page

---

## Next Phase

Proceed to **Phase 4: Profile & Verification UI** after all acceptance criteria are met.