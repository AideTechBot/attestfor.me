# Design Document: AttestFor.me — Decentralized Identity Attestation on AT Protocol

## 1. Overview

AttestFor.me is a Keybase-style identity attestation system built on the AT Protocol. It allows AT Protocol identity holders to cryptographically prove ownership of external accounts (Twitter, GitHub, Mastodon, etc.) and publish public keys (PGP/GPG, SSH, age, etc.) — all anchored in their signed AT Proto repository.

---

## 2. Core Concept

AT Protocol repositories are **Merkle-tree-signed data structures**. Every record written to a user's repo is covered by their signing key. This means:

1. User writes a "proof" record to their AT repo claiming ownership of an external account.
2. User posts a specific challenge string (containing their DID + a nonce) on the external platform.
3. Anyone can **replay the verification**: fetch the proof record from the signed repo, then check the external platform for the matching challenge.

This is the same trust model Keybase used, but the "sigchain" is replaced by the AT Proto repo's signed commit history.

---

## 3. Lexicon Design

Base authority: **`me.attest`** (reverse domain of `attest.me`)

### 3.1 Identity Proofs — `me.attest.proof`

A collection of records, each proving ownership of an external identity.

```json
{
  "lexicon": 1,
  "id": "me.attest.proof",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "description": "A proof of ownership of an external account or identity.",
      "record": {
        "type": "object",
        "required": ["service", "handle", "proofUrl", "nonce", "status", "createdAt"],
        "properties": {
          "service": {
            "type": "string",
            "description": "Canonical service identifier.",
            "knownValues": [
              "twitter", "github", "mastodon", "hackernews",
              "reddit", "lobsters", "gitlab", "keybase",
              "linkedin", "dns", "https", "fediverse",
              "bitcoin", "ethereum", "solana", "stellar",
              "monero", "cardano", "polkadot", "cosmos"
            ]
          },
          "handle": {
            "type": "string",
            "description": "The user's handle/username on the external service."
          },
          "proofUrl": {
            "type": "string",
            "format": "uri",
            "description": "URL where the proof text can be found (tweet URL, gist URL, DNS TXT record, etc.)."
          },
          "nonce": {
            "type": "string",
            "description": "Random nonce used in the proof challenge text."
          },
          "challengeText": {
            "type": "string",
            "description": "The full challenge text the user posted on the external service."
          },
          "status": {
            "type": "string",
            "knownValues": ["valid", "revoked"],
            "description": "Current status of this proof."
          },
          "createdAt": {
            "type": "string",
            "format": "datetime"
          }
        }
      }
    }
  }
}
```

**Challenge text format:**

```
I am [did:plc:xyz...] on AT Protocol.
Verifying my [service] account [handle] for attest.me.
Nonce: [random-base62-string]
```

### 3.2 Public Keys — `me.attest.key`

A collection of published public keys.

```json
{
  "lexicon": 1,
  "id": "me.attest.key",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "description": "A published public key.",
      "record": {
        "type": "object",
        "required": ["keyType", "publicKey", "createdAt"],
        "properties": {
          "keyType": {
            "type": "string",
            "description": "Type of public key.",
            "knownValues": [
              "pgp", "ssh-rsa", "ssh-ed25519", "ssh-ecdsa",
              "age", "minisign", "signify", "wireguard",
              "fido2"
            ]
          },
          "fingerprint": {
            "type": "string",
            "description": "Key fingerprint (for PGP: 40-char hex; for SSH: SHA256 hash)."
          },
          "publicKey": {
            "type": "string",
            "description": "The full public key in standard text format (ASCII-armored PGP, OpenSSH format, etc.).",
            "maxGraphemes": 16384
          },
          "label": {
            "type": "string",
            "description": "Human-readable label for this key (e.g. 'work laptop', 'signing key').",
            "maxGraphemes": 128
          },
          "comment": {
            "type": "string",
            "description": "Optional comment or description.",
            "maxGraphemes": 512
          },
          "expiresAt": {
            "type": "string",
            "format": "datetime",
            "description": "Optional expiration date."
          },
          "status": {
            "type": "string",
            "knownValues": ["active", "revoked"],
            "description": "Current status of this key."
          },
          "createdAt": {
            "type": "string",
            "format": "datetime"
          }
        }
      }
    }
  }
}
```

### 3.3 Profile Metadata — `me.attest.profile`

Optional singleton record for attestation profile settings.

```json
{
  "lexicon": 1,
  "id": "me.attest.profile",
  "defs": {
    "main": {
      "type": "record",
      "key": "literal:self",
      "description": "Attestation profile metadata.",
      "record": {
        "type": "object",
        "properties": {
          "displayName": {
            "type": "string",
            "maxGraphemes": 128
          },
          "bio": {
            "type": "string",
            "maxGraphemes": 1024
          },
          "website": {
            "type": "string",
            "format": "uri"
          },
          "preferredKeyId": {
            "type": "string",
            "description": "Record key of the preferred/primary public key from me.attest.key."
          }
        }
      }
    }
  }
}
```

### 3.4 Signed Statements — `me.attest.statement`

A collection of signed, timestamped public statements — software checksums, declarations, attestations of fact, etc.

```json
{
  "lexicon": 1,
  "id": "me.attest.statement",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "description": "A signed public statement or attestation.",
      "record": {
        "type": "object",
        "required": ["content", "createdAt"],
        "properties": {
          "content": {
            "type": "string",
            "description": "The statement text.",
            "maxGraphemes": 10000
          },
          "subject": {
            "type": "string",
            "description": "Optional short subject/title for the statement.",
            "maxGraphemes": 256
          },
          "tags": {
            "type": "array",
            "description": "Optional tags for categorization.",
            "items": { "type": "string", "maxGraphemes": 64 },
            "maxLength": 10
          },
          "ref": {
            "type": "string",
            "format": "uri",
            "description": "Optional URI this statement references (e.g. a release URL, a document)."
          },
          "status": {
            "type": "string",
            "knownValues": ["active", "retracted"],
            "description": "Current status of this statement."
          },
          "createdAt": {
            "type": "string",
            "format": "datetime"
          }
        }
      }
    }
  }
}
```

**Example use cases:**
- `"The SHA-256 of myapp-v2.1.0.tar.gz is a1b2c3d4e5f6..."`
- `"I am the same person as @oldhandle, which I am deactivating."`
- `"I endorse the following public key for code signing: ..."`
- `"Warrant canary: As of 2026-02-13, I have not received any government requests for data."`

### 3.5 Web of Trust / Following — `me.attest.follow`

A record indicating that a user has verified another user's proofs and vouches for their identity.

```json
{
  "lexicon": 1,
  "id": "me.attest.follow",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "description": "A signed attestation that you have verified another user's identity proofs.",
      "record": {
        "type": "object",
        "required": ["subject", "verifiedAt", "createdAt"],
        "properties": {
          "subject": {
            "type": "string",
            "format": "did",
            "description": "The DID of the user whose identity you are vouching for."
          },
          "verifiedProofs": {
            "type": "array",
            "description": "List of proof record keys (rkeys) that were verified at the time of following.",
            "items": { "type": "string" }
          },
          "verifiedKeys": {
            "type": "array",
            "description": "List of key record keys (rkeys) that were verified at the time of following.",
            "items": { "type": "string" }
          },
          "comment": {
            "type": "string",
            "description": "Optional comment about the verification.",
            "maxGraphemes": 512
          },
          "verifiedAt": {
            "type": "string",
            "format": "datetime",
            "description": "When the verification was performed."
          },
          "status": {
            "type": "string",
            "knownValues": ["active", "revoked"],
            "description": "Current status of this follow."
          },
          "createdAt": {
            "type": "string",
            "format": "datetime"
          }
        }
      }
    }
  }
}
```

**How it works:** When you view another user's profile on AttestFor.me and verify their proofs are valid, you can "vouch" for them. This writes a `me.attest.follow` record to *your* repo, signed by *your* key, listing exactly which proofs and keys you verified. Over time, this creates a decentralized web of trust — if 50 people you trust have all vouched for someone, you can be more confident in their identity.

---

## 4. Supported Services & Proof Methods

### AT Proto Native Services (Auto-Discovered)

**Concept:** Some services are built on AT Proto with their own lexicons. Unlike external services (Twitter, GitHub) that require manual proof creation, **AT Proto native services can be automatically discovered and verified** by reading the user's AT Proto repository.

**How it works:**
1. User visits another user's AttestFor.me profile
2. AttestFor.me queries the user's AT Proto repo for records matching known lexicons
3. If records exist (e.g., `blue.tangled.post`), the service is automatically shown as "verified"
4. No manual proof creation needed — ownership is cryptographically guaranteed by AT Proto's DID system

**Example:** If a user has posted on Tangled (an AT Proto social app), their repo will contain `blue.tangled.post` records. AttestFor.me can detect this and display "Tangled: ✓ Verified" automatically.

**Service Registry:** A configuration file will maintain the list of known AT Proto services:

```typescript
// config/atproto-services.ts
interface AtProtoService {
  id: string;              // e.g., "tangled"
  name: string;            // e.g., "Tangled"
  lexicons: string[];      // e.g., ["blue.tangled.post", "blue.tangled.profile"]
  profileLexicon?: string; // Lexicon to query for profile data (e.g., "app.bsky.actor.profile")
  icon?: string;           // Optional icon URL
  url?: string;            // Optional service URL template: "https://tangled.xyz/profile/{handle}"
  description?: string;    // What this service is
  priority: number;        // Priority for profile data fallback (lower = higher priority)
}

export const ATPROTO_SERVICES: AtProtoService[] = [
  {
    id: "bluesky",
    name: "Bluesky",
    lexicons: ["app.bsky.feed.post", "app.bsky.feed.like"],
    profileLexicon: "app.bsky.actor.profile",
    url: "https://bsky.app/profile/{handle}",
    description: "Bluesky Social",
    priority: 1, // Default priority
  },
  {
    id: "tangled",
    name: "Tangled",
    lexicons: ["blue.tangled.post", "blue.tangled.profile"],
    profileLexicon: "blue.tangled.profile",
    url: "https://tangled.xyz/profile/{handle}",
    description: "Decentralized social network on AT Proto",
    priority: 2,
  },
  // More services added as they launch
  // Priority determines fallback order for profile data
];
```

**Profile Data Priority Fallback:** Since AttestFor.me supports multiple AT Proto services, profile data (display name, avatar, bio) is retrieved using a **priority-based fallback system**:

1. **Primary:** Check Bluesky profile (`app.bsky.actor.profile`) — priority 1
2. **Fallback:** If no Bluesky profile exists, check next service by priority (e.g., Tangled)
3. **Continue:** Iterate through all services ordered by priority until profile data is found

This ensures users with only a "Blacksky" (hypothetical alternative AT Proto app) account can still see their profile data on AttestFor.me, even if they don't have a Bluesky account.

```typescript
// Get profile data with priority fallback
async function getProfileData(did: string): Promise<ProfileData | null> {
  // Sort services by priority (ascending)
  const sortedServices = ATPROTO_SERVICES
    .filter(s => s.profileLexicon)
    .sort((a, b) => a.priority - b.priority);
  
  for (const service of sortedServices) {
    try {
      const profile = await fetchProfileFromLexicon(did, service.profileLexicon);
      if (profile) {
        return {
          displayName: profile.displayName,
          avatar: profile.avatar,
          description: profile.description,
          source: service.name, // Track which service provided the data
        };
      }
    } catch (error) {
      // Service might not be available, try next
      continue;
    }
  }
  
  return null; // No profile data found from any service
}
```

**Verification logic:**

```typescript
// Check if user has any records for a given lexicon
async function hasAtProtoService(did: string, service: AtProtoService): Promise<boolean> {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  
  for (const lexicon of service.lexicons) {
    try {
      const response = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: lexicon,
        limit: 1,
      });
      
      if (response.data.records.length > 0) {
        return true; // User has at least one record of this type
      }
    } catch (error) {
      // Lexicon might not be recognized by PDS, but that's okay
      continue;
    }
  }
  
  return false;
}
```

**UI Display:**
- Auto-discovered services appear in a separate section: "AT Proto Services"
- Always show green checkmark (✓) since presence of records = verified ownership
- Link to user's profile on that service (if `url` template provided)
- No "verify" button needed — it's automatic

**Phase 2.5** implements this feature.

---

### Phase 2: Initial Services (Currently Supported)

| Service | Proof Method | Proof URL | Status |
|---|---|---|---|
| **Twitter/X** | Tweet containing challenge text | Tweet URL | ✅ Phase 2 |
| **GitHub** | Public gist with challenge text | Gist URL | ✅ Phase 2 |

### Phase 6: Additional Services (Coming Soon)

| Service | Proof Method | Proof URL | Status |
|---|---|---|---|
| **DNS** | TXT record: `attest-me-proof=did:plc:xyz,nonce` | `dns://domain.com` | 🔄 Phase 6 |
| **HTTPS** | `/.well-known/attest-me.json` on domain | `https://domain.com/.well-known/attest-me.json` | 🔄 Phase 6 |
| **Mastodon/Fediverse** | Toot containing challenge text | Toot URL | 🔄 Phase 6 |
| **Hacker News** | "About" field containing challenge text | `https://news.ycombinator.com/user?id=X` | 🔄 Phase 6 |
| **Reddit** | Post/comment with challenge text | Reddit permalink | 🔄 Phase 6 |
| **LinkedIn** | Post with challenge text | Post URL | 🔄 Phase 6 |
| **GitLab** | Snippet with challenge text | Snippet URL | 🔄 Phase 6 |
| **Lobsters** | Profile URL field or comment | Lobsters URL | 🔄 Phase 6 |

### Phase 7-8: Cryptocurrency Wallets (Coming Soon)

| Service | Proof Method | Proof URL | Status |
|---|---|---|---|
| **Ethereum** | Sign message with wallet (EIP-191 personal_sign) | `ethereum://address` | 🔄 Phase 7 |
| **Bitcoin** | Sign message with wallet private key | `bitcoin://address` | 🔄 Phase 7 |
| **Solana** | Sign message with wallet (Phantom, etc.) | `solana://address` | 🔄 Phase 8 |
| **Stellar** | Sign message with Stellar secret key | `stellar://address` | 🔄 Phase 8 |
| **Cardano** | Sign message with wallet (CIP-30) | `cardano://address` | 🔄 Phase 8 |
| **Polkadot** | Sign message with wallet (polkadot.js) | `polkadot://address` | 🔄 Phase 8 |
| **Cosmos** | Sign message with wallet (Keplr, etc.) | `cosmos://address` | 🔄 Phase 8 |
| **Monero** | Sign message with wallet (prove-by-message) | `monero://address` | 🔄 Phase 8 |

**Cryptocurrency proof verification:** Unlike service proofs (which require fetching an external URL), wallet proofs are **self-verifying**. The user signs the challenge text with their wallet's private key, and the signature is stored in the proof record. Anyone can verify the signature against the public address — no external service trust required. This is cryptographically stronger than most other proof types.

### Supported Key Types

| Key Type | Format | Example Use |
|---|---|---|
| **PGP/GPG** | ASCII-armored public key | Email signing, Git commit signing |
| **SSH RSA** | OpenSSH public key format | Server authentication |
| **SSH Ed25519** | OpenSSH public key format | Server authentication |
| **SSH ECDSA** | OpenSSH public key format | Server authentication |
| **age** | age public key (`age1...`) | File encryption (modern replacement for PGP encryption) |
| **Minisign** | Minisign public key | File/package signing |
| **Signify** | Signify public key (OpenBSD) | File/package signing |
| **WireGuard** | WireGuard public key | VPN peer identity |
| **FIDO2/WebAuthn** | COSE public key (base64) | Hardware security key binding |

---

## 5. Verification Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   User on    │     │  AttestFor.me│     │  External       │
│  AT Proto    │     │  Web App     │     │  Service        │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘
       │                   │                      │
       │  1. "Prove my     │                      │
       │     Twitter"      │                      │
       │──────────────────>│                      │
       │                   │                      │
       │  2. Generate      │                      │
       │     nonce +       │                      │
       │     challenge text│                      │
       │<──────────────────│                      │
       │                   │                      │
       │  3. Post challenge│                      │
       │     text on       │──────────────────────>
       │     Twitter       │                      │
       │                   │                      │
       │  4. Paste tweet   │                      │
       │     URL back      │                      │
       │──────────────────>│                      │
       │                   │  5. Fetch & verify   │
       │                   │     challenge text   │
       │                   │─────────────────────>│
       │                   │<─────────────────────│
       │                   │                      │
       │  6. Write proof   │                      │
       │     record to     │                      │
       │     AT repo       │                      │
       │<──────────────────│                      │
       │                   │                      │
```

**Third-party verification (replay):**

1. Read proof record from user's AT Proto repo (signed by user's key).
2. Fetch the external proof URL.
3. Confirm challenge text matches (contains correct DID + nonce).
4. The proof is valid as long as both the repo record and external proof exist.

---

## 6. Architecture & Implementation Plan

### 6.1 Profile Page Routes

AttestFor.me provides **two distinct profile views** to serve different user needs:

#### Route 1: Simple Profile (LinkTree-Style) — `/[handle]`

**Purpose:** Non-technical, consumer-friendly interface for viewing verified accounts.

**Target Audience:** General users, recruiters, collaborators who want a quick overview of someone's verified identities.

**Features:**
- Clean, minimal design similar to Linktree/Bento
- Large profile picture and display name
- Grid of verified account cards (GitHub, Twitter, Ethereum, etc.)
- Each card shows:
  - Service icon and name
  - Verified handle/address
  - Visual verification checkmark (✓ Verified / ⚠ Unverified)
  - Optional last verified timestamp
- Click account card to visit the actual service (GitHub profile, Twitter account, etc.)
- Footer link: "View Technical Details →" (links to detailed profile)
- Share button to copy profile link
- **No technical jargon, DIDs, or cryptographic details visible**

**Example:** `attestfor.me/alice.bsky.social`

---

#### Route 2: Technical Details Profile — `/[handle]/details`

**Purpose:** Full technical verification dashboard for power users, developers, and auditors.

**Target Audience:** Security researchers, developers, other technical users who want to verify proofs independently or inspect cryptographic details.

**Features:**
- **Full DID displayed prominently** (`did:plc:abc123...`)
- All proofs with expandable details:
  - Challenge text
  - Proof URL
  - Signature (for wallet proofs)
  - Verification status with timestamps
  - Client-side replay verification button
  - Server-cached verification badge
- **Public Keys section:**
  - PGP/GPG keys with fingerprints
  - SSH keys (RSA, Ed25519, ECDSA)
  - age, minisign, signify keys
  - WireGuard keys
  - FIDO2 public keys
  - Key expiration status
- **Signed Statements:**
  - List of statements with signature verification
  - Timestamp and retraction status
- **Web of Trust:**
  - List of users who vouch for this identity
  - Trust graph visualization
- **Actions:**
  - Re-verify all proofs
  - Export verification report (JSON)
  - Copy DID
- Navigation: "← Back to Simple Profile" link at top

**Example:** `attestfor.me/alice.bsky.social/details`

---

### 6.2 Navigation Between Views

**From Simple → Details:**
- Footer link: "View Technical Details →" or "🔍 Advanced View"
- Keyboard shortcut: `Shift + D` (for "Details")

**From Details → Simple:**
- Header link: "← Simple Profile" or "← Back"
- Keyboard shortcut: `Shift + S` (for "Simple")

**Direct Access:**
- Both routes are publicly accessible
- Can be bookmarked/shared independently
- Default route (`/[handle]`) is the simple view for maximum accessibility

---

### 6.3 Project Structure (additions to existing codebase)

```
lexicons/                          # Lexicon JSON schemas
  me/attest/
    proof.json
    key.json
    profile.json
    statement.json
    follow.json
server/
  routes/                          # API routes
    proofs.ts                      #   CRUD for proofs
    keys.ts                        #   CRUD for keys + key fetch API
    verify.ts                      #   Verification engine
    statements.ts                  #   CRUD for signed statements
    follows.ts                     #   CRUD for web of trust follows
    sign-verify.ts                 #   In-browser sign & verify
  services/                        # Service-specific verification
    base-verifier.ts               #   Abstract verifier
    twitter.ts
    github.ts
    mastodon.ts
    hackernews.ts
    reddit.ts
    dns.ts
    https.ts
    wallets/                       # Cryptocurrency wallet verifiers
      bitcoin.ts
      ethereum.ts
      solana.ts
      stellar.ts
      base-wallet-verifier.ts
  lib/
    challenge.ts                   # Nonce generation, challenge text formatting
    atproto-repo.ts                # Read/write records to AT repo
    key-parser.ts                  # Parse/validate public keys, extract fingerprints
src/
  pages/
    ProfilePage.tsx                # Simple LinkTree-style profile (default view)
    ProfileDetailsPage.tsx         # Technical details profile (advanced view)
    AddProofPage.tsx               # Step-by-step proof wizard
    AddKeyPage.tsx                 # Public key upload
    SignVerifyPage.tsx             # In-browser sign & verify tool
    StatementsPage.tsx             # View/create signed statements
  components/
    Profile/
      SimpleProofCard.tsx          # Minimal proof card for simple view
      DetailedProofCard.tsx        # Full proof details for technical view
      KeyCard.tsx                  # Display a public key with fingerprint
      StatementCard.tsx            # Display a signed statement
      TrustBadge.tsx               # Web of trust badge (N people vouch)
      ViewToggle.tsx               # Switch between simple/detailed views
    ProofWizard/                   # Multi-step proof flow
      ServiceSelect.tsx
      ChallengeStep.tsx
      VerifyStep.tsx
      WalletSignStep.tsx           # Wallet-specific signing step
    KeyUpload.tsx                  # Key paste/upload component
    SignVerify/                    # Sign & verify UI
      SignForm.tsx
      VerifyForm.tsx
      SignedOutput.tsx
```

### 6.4 Server API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/proofs/:did` | List all proofs for a DID |
| `POST` | `/api/proofs/challenge` | Generate a new challenge (nonce + text) |
| `POST` | `/api/proofs/verify` | Verify a proof URL and write to repo |
| `DELETE` | `/api/proofs/:rkey` | Revoke a proof |
| `GET` | `/api/keys/:did` | List all public keys for a DID |
| `POST` | `/api/keys` | Publish a new public key |
| `DELETE` | `/api/keys/:rkey` | Revoke a key |
| `GET` | `/api/profile/:did` | Get attestation profile |
| `GET` | `/api/verify/:did` | Full verification report for a DID |
| `POST` | `/api/proofs/wallet/verify` | Verify a cryptocurrency wallet signature |
| `GET` | `/api/statements/:did` | List all signed statements for a DID |
| `POST` | `/api/statements` | Publish a new signed statement |
| `DELETE` | `/api/statements/:rkey` | Retract a statement |
| `GET` | `/api/follows/:did` | List all follows (vouches) by a DID |
| `GET` | `/api/followers/:did` | List all users who vouch for a DID |
| `POST` | `/api/follows` | Vouch for another user's identity |
| `DELETE` | `/api/follows/:rkey` | Revoke a vouch |
| `POST` | `/api/sign` | Sign a message using a published key (client-side) |
| `POST` | `/api/verify-signature` | Verify a signed message against a user's keys |
| `GET` | `/api/keys/:did/ssh` | Fetch SSH public keys (OpenSSH format, like GitHub's `/username.keys`) |
| `GET` | `/api/keys/:did/pgp` | Fetch PGP public keys (ASCII-armored) |
| `GET` | `/api/keys/:did/all` | Fetch all public keys in a structured format |
| `POST` | `/api/keys/fido2/register` | Register a FIDO2/WebAuthn hardware key |

### 6.3 Technology Choices

- **Lexicon records**: Written directly to user's PDS via AT Proto API (using existing OAuth session)
- **Verification**: Server-side fetching of external proof URLs (to avoid CORS issues)
- **Key parsing**: Use libraries like `openpgp` (for PGP) and custom parsers for SSH/age/etc.
- **No separate database needed**: All data lives in AT Proto repos. The server is stateless — it only verifies and proxies writes.

### 6.3.1 Coding Conventions

These conventions **must** be followed by all contributors and AI agents working on the codebase.

#### Shared Types — No Duplication

Types and interfaces used by **both** the server (`server/`) and the client (`src/`) **must** live in the `types/` directory at the project root. Never duplicate a type across server and client files.

```
types/
  config.ts     ← ClientConfig, RequestMode, ClientDirectOperations
  index.ts      ← InitialState (and future shared types)
```

Both `tsconfig.app.json` (client) and `tsconfig.server.json` (server) can resolve imports from `types/`. Example import from either side:

```typescript
import type { ClientConfig } from "../../types/config";   // from src/lib/
import type { ClientConfig } from "../types/config";       // from server/
```

When adding a new type that both sides need, add it to `types/` — not to `src/` or `server/`.

#### SSR-Injected Runtime Data — Use `window.__*__`, Not Fetch

Any data the client needs on first render that is known at SSR time **must** be injected into the HTML via `window` globals inside a `<script>` tag — not fetched from an API endpoint after load. This avoids an extra round-trip, eliminates a flash of default state, and keeps hydration synchronous.

**Pattern (server side — `server/dev-server.ts` and production equivalent):**

```typescript
const injectScript = [
  `<script>`,
  `window.__HAS_SESSION__=${hasSession ? "true" : "false"};`,
  `window.__CLIENT_CONFIG__=${getClientConfigScript()};`,
  `</script>`,
].join("");

const html = template
  .replace("<!--app-html-->", appHtml)
  .replace('<div id="root">', injectScript + '<div id="root">');
```

**Pattern (client side — read synchronously, no async init):**

```typescript
// src/lib/client-config.ts
export function getConfig(): ClientConfig {
  if (typeof window !== "undefined" && window.__CLIENT_CONFIG__) {
    return window.__CLIENT_CONFIG__ as ClientConfig;
  }
  return DEFAULT_CONFIG; // fallback for SSR render pass
}
```

**Checklist for adding a new `window.__*__` value:**

1. Declare it in `src/global.d.ts` on the `Window` interface.
2. Build it on the server and add it to the inject script.
3. Read it synchronously on the client — no `await`, no `fetch`.

Existing injected values:

| Variable | Purpose |
|---|---|
| `window.__HAS_SESSION__` | Whether the user has an active session cookie |
| `window.__CLIENT_CONFIG__` | Request-routing mode & API URLs (see `types/config.ts`) |

### 6.4 State Management Strategy

**Recommendation: Start with React Context + TanStack Query, add Redux only if needed**

**Why not Redux immediately:**
- Most state is page-specific (proof wizard, profile view)
- AT Proto data can be cached with TanStack Query (better than Redux for API state)
- Authentication state fits well in React Context
- Smaller bundle size and simpler mental model initially
- Can migrate to Redux later if complexity grows

**Proposed Architecture:**

1. **TanStack Query (React Query)** for API state:
   - Automatic caching, refetching, and background updates
   - Perfect for profile data, proofs, keys, statements
   - Built-in loading/error states
   - Optimistic updates for proof verification

2. **React Context** for global UI state:
   - `AuthContext` - User session, DID, authentication status
   - `ThemeContext` - Dark mode, UI preferences (if needed)
   - `NotificationContext` - Toast queue with useReducer (action-based management)

**Toast notifications use Context + useReducer:**
```typescript
// contexts/NotificationContext.tsx
type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' };
type NotificationAction = 
  | { type: 'ADD'; toast: Omit<Toast, 'id'> }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' };

function notificationReducer(state: Toast[], action: NotificationAction) {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast];
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

export function NotificationProvider({ children }) {
  const [toasts, dispatch] = useReducer(notificationReducer, []);
  
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    dispatch({ type: 'ADD', toast: { ...toast, id: crypto.randomUUID() } });
  }, []);
  
  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);
  
  return (
    <NotificationContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </NotificationContext.Provider>
  );
}
```

3. **Local useState/useReducer** for component state:
   - Proof wizard multi-step form
   - Expandable proof cards
   - Form inputs

4. **Custom hooks** for shared logic:
   - `useAuth()` - Access auth context
   - `useProfile(did)` - Fetch and cache profile data
   - `useProofVerification(uri)` - Handle proof verification
   - `useNetworkStatus()` - Online/offline detection

### When You Actually Need Redux

**Start without Redux. Migrate to Redux when you hit these specific problems:**

#### 🚨 Clear Signs You Need Redux:

1. **Complex Cross-Tab State Synchronization**
   - Example: User verifies a proof in Tab A, Tab B needs to update immediately
   - Why Redux helps: Redux + middleware can sync state across tabs via BroadcastChannel
   - Alternative: SharedWorker or manual BroadcastChannel implementation

2. **Offline-First with Complex State Persistence**
   - Example: Queue 10+ proof verification attempts offline, sync when online with conflict resolution
   - Why Redux helps: Redux + redux-persist + middleware for queue management
   - Alternative: IndexedDB with manual reconciliation (complex)

3. **Deep Component Trees with Prop Drilling Hell**
   - Example: 5+ levels deep, passing 10+ props through every level
   - Why Redux helps: Connect components directly to store
   - **But first try:** React Context (usually sufficient) or component composition patterns

4. **Complex Derived State with Multiple Dependencies**
   - Example: Web of trust graph with 100+ users, recalculating trust scores based on follows/unfollows across many views
   - Why Redux helps: Reselect memoization prevents unnecessary recalculations
   - Alternative: useMemo in Context (often sufficient)

5. **Time-Travel Debugging is Critical**
   - Example: Debugging complex multi-step proof verification flows
   - Why Redux helps: Redux DevTools shows every state change
   - Alternative: React DevTools + manual logging (less powerful)

6. **Team Size & Preferences**
   - Team of 5+ developers who all know Redux patterns
   - Standardized patterns prevent "Context soup" chaos
   - Enforcement of unidirectional data flow

#### ✅ You DON'T Need Redux If:

- ❌ Your app has < 20 components
- ❌ State is mostly API responses (use TanStack Query)
- ❌ State changes are simple (toggle, update field)
- ❌ You have < 3 global state contexts
- ❌ You're just starting and want to ship quickly
- ❌ Most state is page-specific (doesn't need to be global)

#### 📊 Size Thresholds (Very Rough Guidelines):

| App Size | State Complexity | Recommendation |
|----------|------------------|----------------|
| < 10 routes, < 20 components | Simple (auth, theme, toasts) | **Context + TanStack Query** |
| 10-30 routes, 20-50 components | Medium (auth, settings, notifications, some shared UI state) | **Context + TanStack Query** (still fine) |
| 30-50 routes, 50-100 components | Medium-High (cross-tab sync needed, offline-first, complex derived state) | **Consider Redux** |
| 50+ routes, 100+ components | High (enterprise app, multi-user real-time, complex business logic) | **Redux or Zustand** |

#### 🎯 For AttestFor.me Specifically:

**Current scope** (Phases 0-6):
- ~10-15 routes (home, profile, proof wizard, keys, statements, etc.)
- ~30-40 components
- Global state: auth, theme, toasts
- Mostly API state (profiles, proofs, keys)

**Verdict: Context + TanStack Query is perfect. Don't add Redux yet.**

**When to reconsider** (Phase 7-9+):
- Adding real-time collaboration features
- Building desktop/mobile apps with offline-first
- Web of trust graph becomes extremely complex (100s of connections)
- Adding multi-account management
- Cross-tab state sync becomes critical

**Example structure:**

```typescript
// contexts/AuthContext.tsx
export const AuthContext = createContext<AuthContextValue>();

export function AuthProvider({ children }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check session on mount
  useEffect(() => {
    checkAuthErrorParams();
    fetchSession();
  }, []);
  
  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// hooks/useProfile.ts
export function useProfile(did: string) {
  return useQuery({
    queryKey: ['profile', did],
    queryFn: () => fetchProfile(did),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// hooks/useProofVerification.ts
export function useProofVerification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: verifyProof,
    onSuccess: (data) => {
      // Invalidate profile cache
      queryClient.invalidateQueries(['profile', data.did]);
      toast.success('Proof verified!');
    },
  });
}
```

**Dependencies to add:**
```bash
pnpm add @tanstack/react-query
pnpm add @tanstack/react-query-devtools
```

### Option 1: TanStack Query with SSR (Recommended)

**Why this is better:** TanStack Query is the most powerful option with excellent caching, deduplication, and SSR support when configured properly.

**SSR Setup:**

```typescript
// entry-server.tsx
import { QueryClient, dehydrate, QueryClientProvider } from '@tanstack/react-query';

export async function render(request: Request) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: 2,
      },
    },
  });
  
  const context = await handler.query(request);
  if (context instanceof Response) return { redirect: context };
  
  const hasSession = /* ...check session cookie... */;
  
  // Prefetch critical data server-side
  const url = new URL(request.url);
  const didMatch = url.pathname.match(/^\/(did:[^/]+)/);
  if (didMatch) {
    await queryClient.prefetchQuery({
      queryKey: ['profile', didMatch[1]],
      queryFn: () => fetchProfile(didMatch[1]),
    });
  }
  
  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <SessionHintProvider hasSession={hasSession}>
        <StaticRouterProvider router={router} context={context} />
      </SessionHintProvider>
    </QueryClientProvider>
  );
  
  // Serialize the cache for hydration
  const dehydratedState = dehydrate(queryClient);
  const isNotFound = /* ...check 404... */;
  
  return { html, notFound: isNotFound, hasSession, dehydratedState };
}
```

```typescript
// server/index.ts - inject dehydrated state into HTML
const { html, notFound, hasSession, dehydratedState } = await render(request);

const fullHtml = htmlTemplate
  .replace('<!--app-html-->', html)
  .replace(
    '<script',
    `<script>window.__REACT_QUERY_STATE__=${JSON.stringify(dehydratedState).replace(/</g, '\\u003c')};</script><script`
  );
```

```typescript
// entry-client.tsx
import { QueryClient, QueryClientProvider, HydrationBoundary } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
    },
  },
});

const router = createBrowserRouter(routes);
const hasSession = !!window.__HAS_SESSION__;
const dehydratedState = window.__REACT_QUERY_STATE__;

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

hydrateRoot(
  rootElement,
  <QueryClientProvider client={queryClient}>
    <HydrationBoundary state={dehydratedState}>
      <SessionHintProvider hasSession={hasSession}>
        <RouterProvider router={router} />
      </SessionHintProvider>
    </HydrationBoundary>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
```

**Pros:**
- Automatic cache hydration from server to client
- No duplicate fetches on page load
- Best-in-class caching, deduplication, refetching
- DevTools for debugging
- Largest ecosystem and community

**Cons:**
- Requires SSR configuration (documented above)
- Slightly more complex setup than SWR

### Option 2: SWR (Simpler Alternative)

**Why this is easier:** SWR has simpler SSR setup and is more lightweight than TanStack Query.

```bash
pnpm add swr
```

```typescript
// entry-server.tsx
import { SWRConfig } from 'swr';

export async function render(request: Request) {
  // Prefetch data server-side
  const fallback = {};
  const url = new URL(request.url);
  const didMatch = url.pathname.match(/^\/(did:[^/]+)/);
  
  if (didMatch) {
    const profile = await fetchProfile(didMatch[1]);
    fallback[`/api/profile/${didMatch[1]}`] = profile;
  }
  
  const html = renderToString(
    <SWRConfig value={{ fallback }}>
      <SessionHintProvider hasSession={hasSession}>
        <StaticRouterProvider router={router} context={context} />
      </SessionHintProvider>
    </SWRConfig>
  );
  
  return { html, notFound, hasSession, fallback };
}
```

```typescript
// entry-client.tsx
import { SWRConfig } from 'swr';

const fallback = window.__SWR_STATE__ || {};

hydrateRoot(
  rootElement,
  <SWRConfig value={{ fallback }}>
    <SessionHintProvider hasSession={hasSession}>
      <RouterProvider router={router} />
    </SessionHintProvider>
  </SWRConfig>
);
```

```typescript
// hooks/useProfile.ts
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useProfile(did: string) {
  const { data, error, isLoading } = useSWR(
    `/api/profile/${did}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );
  
  return { profile: data, error, loading: isLoading };
}
```

**Pros:**
- Simpler API than TanStack Query
- Easier SSR setup (just pass `fallback` prop)
- Good caching and revalidation
- Smaller bundle size

**Cons:**
- Less features than TanStack Query (no query invalidation patterns, less control)
- Smaller ecosystem
- No built-in DevTools

**Recommendation:** Start with **SWR** for simplicity, migrate to **TanStack Query** if you need advanced features like optimistic updates, complex cache invalidation, or infinite queries.

---

## 7. Security Considerations

1. **Nonce uniqueness**: Each proof uses a cryptographically random nonce (≥128 bits) to prevent replay attacks across users.
2. **DID binding**: Challenge text includes the user's DID, binding the proof to a specific identity.
3. **Revocation**: Users can revoke proofs/keys by updating the `status` field to `"revoked"` in their repo.
4. **No private keys stored**: AttestFor.me never handles private keys. Only public keys are published.
5. **Verification is public**: Anyone can independently verify proofs by reading the AT repo and checking external services. No trust in AttestFor.me required.
6. **Rate limiting**: Proof creation and verification endpoints should be rate-limited to prevent abuse.
7. **Authentication error handling**: OAuth errors must gracefully return users to their original page with user-friendly error messages (not raw JSON).

---

## 8. Implementation Phases

> **Note:** Detailed phase-by-phase implementation guides are available in the `docs/` folder:
> - [Phase 0: Client/Server Architecture](./phase-0-client-server-architecture.md)
> - [Phase 0.5: Authentication & Error Handling](./phase-0.5-auth-error-handling.md)
> - [Phase 1: Foundation](./phase-1-foundation.md)
> - [Phase 2: Verification & Wallets](./phase-2-verification-wallets.md)
> - [Phase 3: Keys + Sign/Verify](./phase-3-keys-sign-verify.md)
> - [Phase 4: Profile UI](./phase-4-profile-ui.md)
> - [Phase 5: Web of Trust](./phase-5-web-of-trust.md)
> - [Phase 6: Hardware Keys + Advanced](./phase-6-hardware-keys-advanced.md)
> - [Proof Storage & Verification Architecture](./proof-storage-verification.md)

### Phase 0.5 — Authentication & Error Handling

- [ ] Implement returnTo parameter for OAuth flow (preserve original URL)
- [ ] Add OAuth error handling middleware
- [ ] Create user-friendly error pages (not raw JSON responses)
- [ ] Session expiration detection and graceful re-authentication
- [ ] Error toast notifications with retry actions
- [ ] Authentication state debugging UI (for development)
- [ ] Comprehensive error logging (server-side)
- [ ] Rate limit exceeded error pages
- [ ] Network error handling with offline detection

### Phase 0 — Client/Server Architecture (Cost Optimization)

- [ ] Implement UnifiedAtpClient with request mode switching (server-proxy, client-direct, hybrid)
- [ ] Add server-side AT Proto proxy endpoints
- [ ] Add configuration UI for switching modes
- [ ] 97% cost savings in hybrid mode vs full server-proxy

### Phase 1 — Foundation

- [ ] Create lexicon schema files (proof, key, profile, statement, follow)
- [ ] **Proof lexicon includes serverVerification object for caching**
- [ ] Implement challenge generation and text formatting
- [ ] Build AT Proto repo read/write helpers for custom lexicons
- [ ] Server API routes for proofs and keys

### Phase 2 — Core Proof Verification (Twitter/X + GitHub Only)

- [ ] Implement base verifier interface
- [ ] Implement GitHub gist verifier
- [ ] Implement Twitter/X verifier
- [ ] Build proof wizard UI (service select → challenge → verify)
- [ ] `POST /api/proofs/verify` endpoint for GitHub and Twitter
- [ ] **Client-side proof replay verification with step-by-step UI**
- [ ] **Server-side cached verification with 24h Redis TTL (anti-DDoS)**
- [ ] **Server verification badge component showing cache status**
- [ ] Error handling for verification failures

### Phase 2.5 — AT Proto Native Service Auto-Discovery

- [ ] Create `config/atproto-services.ts` with service registry
- [ ] **Registry includes: service ID, name, lexicons array, profileLexicon, priority, optional icon/url/description**
- [ ] Implement `hasAtProtoService(did, service)` helper function
- [ ] **Implement `getProfileData(did)` with priority-based fallback system**
- [ ] **Profile data fallback order: Bluesky (priority 1) → Tangled (priority 2) → other services by priority**
- [ ] Query user's AT Proto repo for each registered service's lexicons
- [ ] Display auto-discovered services in separate "AT Proto Services" section
- [ ] Always show green checkmark (✓) for discovered services (no manual verification needed)
- [ ] Link to user's profile on that service (using URL template: `{handle}` or `{did}` placeholders)
- [ ] Handle PDS errors gracefully (lexicon might not be recognized)
- [ ] **Simple profile view:** Show AT Proto services alongside external proofs
- [ ] **Technical profile view:** Show which specific lexicons were detected AND which service provided profile data
- [ ] Cache AT Proto service checks (1 hour TTL) to avoid excessive repo queries
- [ ] Add "Refresh" button to re-scan for new services
- [ ] Document how to add new services to the registry
- [ ] **Display profile data source badge (e.g., "Profile from: Bluesky" or "Profile from: Tangled")**

**Acceptance Criteria:**
- Given a user with Tangled posts (`blue.tangled.post` records), their profile shows "Tangled: ✓ Verified"
- Auto-discovered services require zero user interaction (no proof creation flow)
- Service registry is easily extensible (add new service = add object to array)
- Works even if PDS doesn't fully support the lexicon (graceful error handling)
- Clicking service links to their profile on that platform (if URL template exists)
- Technical view shows detected lexicon names (e.g., "blue.tangled.post: 42 records")
- **User with only Blacksky account (no Bluesky) still sees their profile data from Blacksky**
- **User with both Bluesky and Tangled accounts sees Bluesky profile data (higher priority)**
- **Profile page indicates which service provided the profile data**
- **If no AT Proto service has profile data, fallback to DID-only display**

### Phase 3 — Public Keys + Sign & Verify

- [ ] PGP key upload + fingerprint extraction
- [ ] SSH key upload + fingerprint extraction
- [ ] age, minisign, signify, WireGuard key support
- [ ] Key display cards on profile
- [ ] In-browser sign & verify tool (sign text with published key, verify signed messages)
- [ ] Signed statements: create, view, retract (`me.attest.statement`)

### Phase 4 — Profile & Verification UI

- [ ] **Two distinct profile routes:**
  - [ ] **Simple profile (`/:identifier`):** LinkTree-style interface for non-technical users
  - [ ] **Technical details (`/:identifier/details`):** Full verification dashboard with DID, keys, replay verification
- [ ] **Simple profile shows:**
  - [ ] Verified accounts grid with visual checkmarks
  - [ ] No technical jargon (DIDs, signatures, cryptographic details hidden)
  - [ ] Link to external services (GitHub, Etherscan, etc.)
  - [ ] Footer link to technical details view
- [ ] **Technical details profile shows:**
  - [ ] Full DID with copy button
  - [ ] All proofs with expandable technical details (challenge text, signatures)
  - [ ] Public keys with fingerprints
  - [ ] Signed statements
  - [ ] Client-side replay verification
  - [ ] Server-cached verification badges
  - [ ] Re-verify all button
  - [ ] Export verification report
- [ ] Navigation between simple and technical views
- [ ] Proof status badges (✓ verified, ⚠ unverified, ✗ revoked, ⌛ expired)
- [ ] **Integration of ProofReplayVerification and ServerVerificationBadge components**
- [ ] **Proof cards display both client replay and server cached verification options**

### Phase 5 — Web of Trust

- [ ] Follow/vouch system: verify another user's proofs and sign a vouch (`me.attest.follow`)
- [ ] Trust badges on profiles ("N people you trust vouch for this identity")
- [ ] Trust graph visualization
- [ ] Followers/following lists on profile

### Phase 6 — Additional Services

- [ ] DNS TXT record verifier
- [ ] HTTPS/.well-known verifier
- [ ] Mastodon/Fediverse verifier
- [ ] Hacker News verifier
- [ ] Reddit verifier
- [ ] LinkedIn verifier
- [ ] GitLab verifier

### Phase 7 — Cryptocurrency Wallet Proofs

- [ ] Base wallet verifier interface
- [ ] Ethereum wallet verifier (EIP-191 personal_sign)
- [ ] Bitcoin wallet verifier (message signing)
- [ ] Wallet signing UI (MetaMask, browser wallets)
- [ ] `POST /api/proofs/wallet/verify` endpoint

### Phase 8 — Additional Wallet Chains

- [ ] Solana wallet verifier
- [ ] Stellar wallet verifier
- [ ] Cardano wallet verifier
- [ ] Polkadot wallet verifier
- [ ] Cosmos wallet verifier
- [ ] Monero wallet verifier

### Phase 9 — Hardware Keys + Advanced

- [ ] FIDO2/WebAuthn hardware key registration via browser
- [ ] Proof expiration and auto-re-verification
- [ ] Export verification report as signed JSON (for offline verification)

---

## 9. Cryptocurrency Wallet Proofs

Unlike service proofs (Twitter, GitHub, etc.) which rely on posting challenge text on an external platform, cryptocurrency wallet proofs are **self-verifying** using cryptographic signatures.

### Verification Flow

1. Server generates a challenge: `I am did:plc:xyz on AT Protocol. Verifying wallet 0xABC... for attest.me. Nonce: R4nD0m`
2. User signs the challenge with their wallet's private key (e.g., MetaMask `personal_sign` for Ethereum)
3. The **signature** is stored in the proof record (in the `challengeText` field) along with the wallet address
4. Anyone can verify: recover the signer address from the signature + message, check it matches the claimed address

### Why This Is Stronger

Service proofs rely on trusting that the external platform hasn't been compromised (e.g., someone hacking your Twitter). Wallet proofs are pure cryptography — the private key either signed the message or it didn't. No platform trust required.

### Supported Signing Standards

| Chain | Standard | Library/Method |
|---|---|---|
| **Ethereum** | EIP-191 `personal_sign` | MetaMask, WalletConnect, ethers.js |
| **Bitcoin** | Bitcoin Message Signing (BIP-137) | Electrum, Bitcoin Core `signmessage` |
| **Solana** | Ed25519 message signing | Phantom `signMessage`, @solana/web3.js |
| **Stellar** | Ed25519 message signing | Stellar SDK |
| **Cosmos** | ADR-036 off-chain signing | Keplr `signArbitrary` |
| **Polkadot** | Sr25519/Ed25519 signing | polkadot.js `sign` |
| **Cardano** | CIP-30 `signData` | Nami, Eternl wallets |
| **Monero** | `sign` RPC method | Monero CLI/GUI wallet |

---

## 10. Key Fetch API

A simple, developer-friendly API for fetching a user's public keys — modeled after GitHub's `https://github.com/username.keys` convention.

### Endpoints

| URL | Response | Content-Type |
|---|---|---|
| `GET /api/keys/:handle/ssh` | All SSH public keys, one per line (OpenSSH format) | `text/plain` |
| `GET /api/keys/:handle/pgp` | All PGP public keys, ASCII-armored, concatenated | `text/plain` |
| `GET /api/keys/:handle/all` | All keys in structured JSON | `application/json` |
| `GET /:handle.keys` | Shorthand for SSH keys (like GitHub) | `text/plain` |

### Use Cases

**SSH `AuthorizedKeysCommand`:**
```bash
# In /etc/ssh/sshd_config:
AuthorizedKeysCommand /usr/bin/curl -s https://attest.me/api/keys/%u/ssh
AuthorizedKeysCommandUser nobody
```

**Ansible/scripts:**
```bash
curl https://attest.me/@alice.keys >> ~/.ssh/authorized_keys
```

**GPG import:**
```bash
curl https://attest.me/api/keys/@alice/pgp | gpg --import
```

This makes AttestFor.me immediately useful as infrastructure, not just a profile page.

---

## 11. In-Browser Sign & Verify

Users can sign arbitrary text or verify signed messages directly on the website, using keys they've published on AttestFor.me.

### Sign Flow

1. User pastes text they want to sign
2. Selects which of their published keys to use
3. **For PGP**: client-side signing using OpenPGP.js (user provides private key locally, never sent to server)
4. **For SSH**: not practical in-browser (SSH keys don't have a standard signed-message format); display instructions for CLI signing
5. Output: signed message block that can be pasted anywhere

### Verify Flow

1. Anyone pastes a signed message
2. AttestFor.me extracts the signer's key fingerprint
3. Looks up the fingerprint across all published `me.attest.key` records
4. If found: displays the signer's AT Proto identity, their proofs, and verification status
5. If not found: reports the signature is valid but the signer is unknown on AttestFor.me

### Output Format (PGP example)

```
-----BEGIN ATTESTFOR.ME SIGNED MESSAGE-----
Signer: @alice.bsky.social (did:plc:xyz...)
Key: PGP 0xABCD1234 ("alice's signing key")
Date: 2026-02-13T12:00:00Z

The SHA-256 of myapp-v2.1.0.tar.gz is a1b2c3d4e5f6...

-----BEGIN PGP SIGNATURE-----
[standard PGP signature]
-----END PGP SIGNATURE-----
-----END ATTESTFOR.ME SIGNED MESSAGE-----
```

---

## 12. FIDO2/WebAuthn Hardware Key Registration

Users can register a hardware security key (YubiKey, Titan Key, etc.) directly from the browser using the WebAuthn API. This was a frequently requested feature on Keybase that was never implemented.

### How It Works

1. User clicks "Register Hardware Key" on their profile
2. Browser triggers WebAuthn `navigator.credentials.create()` — user taps their YubiKey
3. The resulting COSE public key is extracted from the attestation response
4. Public key is stored as a `me.attest.key` record with `keyType: "fido2"`
5. The `fingerprint` field stores the credential ID (base64url-encoded)
6. The `publicKey` field stores the COSE public key (base64-encoded)

### Limitations

- WebAuthn keys are **origin-bound** — the key registered on `attest.me` is not the same as the user's SSH or PGP key on the YubiKey
- Verification requires interactive challenge-response (not replay-able like other proofs)
- This proves "this AT Proto identity controls a specific hardware authenticator" — useful for high-assurance identity binding

### Why It Matters

Hardware keys provide the strongest proof of identity control. Unlike software keys (which can be copied), a FIDO2 key proves the holder physically possesses a specific device. For high-stakes identity verification, this is the gold standard.

---

## 13. How It Differs from Keybase

| Aspect | Keybase | AttestFor.me |
|---|---|---|
| **Identity anchor** | Keybase sigchain (proprietary) | AT Proto signed repo (open protocol) |
| **Key management** | Keybase device keys | AT Proto signing keys (managed by PDS) |
| **Data storage** | Keybase servers | User's PDS (decentralized) |
| **Discoverability** | Keybase search | AT Proto DID resolution + app search |
| **Portability** | Locked to Keybase | Portable across any AT Proto PDS |
| **E2E encryption** | Yes (KBFS, chat) | Out of scope (focus on identity proofs) |
| **Wallet proofs** | Bitcoin, Zcash, Stellar addresses only | Full signature-based verification for 8+ chains |
| **Hardware keys** | Never implemented (frequently requested) | FIDO2/WebAuthn registration via browser |
| **Key fetch API** | No public API | GitHub-style `username.keys` endpoint |
| **Signed statements** | Saltpack sign (CLI/app only) | In-browser sign & verify + persistent statements |
| **Web of trust** | "Following" (tracked proofs) | Explicit vouch records with proof snapshots |
