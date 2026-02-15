# Profile Routes Comparison

AttestFor.me provides **two distinct profile views** optimized for different audiences and use cases.

---

## Quick Reference

| Feature | Simple Profile<br>`/:identifier` | Technical Details<br>`/:identifier/details` |
|---------|----------------------------------|---------------------------------------------|
| **Target Audience** | General users, recruiters, collaborators | Developers, security researchers, auditors |
| **Design Style** | LinkTree / Bento style | Technical dashboard |
| **Shows DID** | ❌ Hidden | ✅ Prominent display with copy button |
| **Shows Signatures** | ❌ Hidden | ✅ Full signature data |
| **Shows Challenge Text** | ❌ Hidden | ✅ Expandable proof details |
| **Verification Method** | Visual checkmarks only | Client replay + server cached options |
| **Public Keys** | ❌ Hidden | ✅ Full list with fingerprints |
| **Signed Statements** | ❌ Hidden | ✅ Full list with verification |
| **Web of Trust** | ❌ Hidden | ✅ Vouch graph and trust data |
| **Actions** | Share profile link | Re-verify, export report, copy DID |
| **Link to Other View** | "🔍 View Technical Details →" | "← Back to Simple Profile" |

---

## Route 1: Simple Profile (`/:identifier`)

### Purpose
Consumer-friendly interface for quickly viewing verified accounts. No blockchain or cryptography knowledge required.

### URL Examples
- `attestfor.me/alice.bsky.social`
- `attestfor.me/did:plc:abc123xyz` (also works with DID)

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│        [Large Avatar/Photo]         │
│                                     │
│         Alice Henderson             │
│       @alice.bsky.social            │
│                                     │
│   ✓ 8 Verified Accounts             │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ 🐙      │  │ 💎      │          │
│  │ GitHub  │  │ Ethereum│          │
│  │ alice   │  │ 0x123...│          │
│  │    ✓    │  │    ✓    │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ 🐦      │  │ 🌐      │          │
│  │ Twitter │  │ DNS     │          │
│  │ @alice  │  │ alice.io│          │
│  │    ✓    │  │    ✓    │          │
│  └─────────┘  └─────────┘          │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   🔍 View Technical Details →       │
│   📋 Share Profile                  │
│                                     │
└─────────────────────────────────────┘
```

### Features
- **Large profile picture and name** (prominent, welcoming)
- **Grid of verified account cards**
  - Service icon (GitHub 🐙, Ethereum 💎, Twitter 🐦, etc.)
  - Service name
  - Handle/address
  - Verification checkmark (✓ verified, ⚠ unverified)
- **Click card to visit external service**
  - GitHub card → `https://github.com/alice`
  - Ethereum card → `https://etherscan.io/address/0x123...`
  - Twitter card → `https://twitter.com/alice`
- **Share button** copies profile URL
- **Footer link** to technical details view

### What's Hidden
- DIDs (decentralized identifiers)
- Challenge text and proof URLs
- Cryptographic signatures
- Public key fingerprints
- Server verification timestamps
- Replay verification options

---

## Route 2: Technical Details (`/:identifier/details`)

### Purpose
Full technical verification dashboard for power users who want to audit proofs, inspect signatures, or verify independently.

### URL Examples
- `attestfor.me/alice.bsky.social/details`
- `attestfor.me/did:plc:abc123xyz/details`

### Layout

```
┌────────────────────────────────────────────────────────┐
│ ← Back to Simple Profile                               │
├────────────────────────────────────────────────────────┤
│                                                         │
│ [Avatar]  Alice Henderson                              │
│           @alice.bsky.social                           │
│                                                         │
│           DID (Decentralized Identifier):              │
│           ┌──────────────────────────────────┐  [📋]  │
│           │ did:plc:abc123xyz456789          │        │
│           └──────────────────────────────────┘        │
│                                                         │
│           8 / 10 proofs verified                       │
│           5 public keys                                │
│           3 signed statements                          │
│                                                         │
│           [🔄 Re-verify All] [Export Report]          │
│           [View SSH Keys] [View PGP Keys]             │
│                                                         │
├────────────────────────────────────────────────────────┤
│ [Proofs (10)] [Public Keys (5)] [Statements (3)]      │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Proof: GitHub                              ✓ Verified  │
│ ├─ Handle: alice                                       │
│ ├─ Proof URL: https://gist.github.com/...            │
│ ├─ Created: Jan 15, 2026                              │
│ ├─ Last checked: Feb 15, 2026                         │
│ └─ [Show Details ▼]                                    │
│                                                         │
│    ┌─ URI: at://did:plc:abc123/me.attest.proof/xyz   │
│    ├─ Challenge Text:                                  │
│    │  Verifying my GitHub account for AttestFor.me    │
│    │  DID: did:plc:abc123xyz                          │
│    │  Nonce: 9a8b7c6d5e4f3210                         │
│    │                                                    │
│    ├─ Server Verification:                             │
│    │  Result: ✓ Verified                               │
│    │  Verified at: Feb 15, 2026 10:23 AM               │
│    │  Expires: Feb 16, 2026 10:23 AM (23h left)       │
│    │                                                    │
│    └─ Verification Methods:                            │
│       ┌───────────────────────────────────────┐       │
│       │ Client-Side Replay Verification       │       │
│       │                                         │       │
│       │ [Replay Verification]                  │       │
│       │                                         │       │
│       │ ✓ Validate proof record structure      │       │
│       │ ✓ Fetch gist from GitHub API           │       │
│       │ ✓ Verify challenge text present        │       │
│       │ ✓ AT Proto repo signature valid        │       │
│       │                                         │       │
│       │ Proof verified independently at         │       │
│       │ Feb 15, 2026 10:45 AM                  │       │
│       └───────────────────────────────────────┘       │
│                                                         │
│       ┌───────────────────────────────────────┐       │
│       │ 🛡️ Server Verified                    │       │
│       │ Verified at Feb 15, 2026 10:23 AM     │       │
│       │ Cache expires in 23h                   │       │
│       └───────────────────────────────────────┘       │
│                                                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ Proof: Ethereum Wallet                     ✓ Verified  │
│ ├─ Address: 0x1234...5678                             │
│ ├─ Created: Jan 10, 2026                              │
│ └─ [Show Details ▼]                                    │
│                                                         │
│    ┌─ URI: at://did:plc:abc123/me.attest.proof/xyz   │
│    ├─ Signature:                                       │
│    │  0xabcdef1234567890abcdef...                      │
│    │                                                    │
│    ├─ Challenge Text:                                  │
│    │  Verifying Ethereum wallet for AttestFor.me      │
│    │  DID: did:plc:abc123xyz                          │
│    │  Nonce: 1234567890abcdef                         │
│    │                                                    │
│    └─ Verification Methods:                            │
│       [Replay Verification]                            │
│       [Request Server Verification]                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Features

#### DID Section
- **Full DID displayed prominently**
- **Copy button** for easy sharing
- DID format explained in tooltip

#### Proofs Section
- **Expandable proof cards** with all technical details:
  - URI (AT Protocol record identifier)
  - Challenge text (full, unformatted)
  - Proof URL (link to external service)
  - Signature (for wallet proofs)
  - Created/verified/last checked timestamps
  - Server verification metadata (result, timestamp, expiration)
  - Error messages (if verification failed)
  
- **Two verification methods:**
  1. **Client-Side Replay**
     - "Replay Verification" button
     - Shows step-by-step verification process
     - Fetches external content directly
     - No server trust required
  
  2. **Server-Cached Verification**
     - "Request Server Verification" button
     - Shows cached result (24h TTL)
     - Displays cache expiration time
     - Prevents DDoS through rate limiting

- **Re-verify button** for individual proofs
- **Status badges:** ✓ verified, ⚠ unverified, ✗ revoked, ⌛ expired

#### Public Keys Section
- **PGP keys** with fingerprints
- **SSH keys** (RSA, Ed25519, ECDSA)
- **age, minisign, signify, WireGuard** keys
- **FIDO2** hardware keys
- Key type, fingerprint, expiration status
- Export/download buttons

#### Signed Statements Section
- List of statements with timestamps
- Signature verification
- Retraction status

#### Actions
- **Re-verify All Proofs** — refreshes verification for all proofs
- **Export Report** — download JSON verification report
- **View SSH Keys** — opens `/api/keys/:identifier/ssh`
- **View PGP Keys** — opens `/api/keys/:identifier/pgp`
- **Copy DID** — clipboard copy

---

## Navigation Between Views

### From Simple → Details
- Footer link: **"🔍 View Technical Details →"**
- Optional keyboard shortcut: `Shift + D`

### From Details → Simple
- Header link: **"← Back to Simple Profile"**
- Optional keyboard shortcut: `Shift + S`

---

## Use Cases

### Simple Profile Use Cases
1. **Job applications:** "Here are my verified social accounts"
2. **Professional networking:** Quick overview for recruiters
3. **Link sharing:** Include in bio, email signature, business card
4. **Non-technical audiences:** Parents, friends, general public
5. **Quick reference:** "Is this the real alice?"

### Technical Details Use Cases
1. **Security audit:** "Are these proofs actually valid?"
2. **Independent verification:** Replay verification without trusting server
3. **Key exchange:** Copy SSH/PGP keys for encrypted communication
4. **Trust evaluation:** Check web of trust vouches
5. **Compliance verification:** Export signed verification report
6. **Troubleshooting:** Debug why a proof isn't verifying
7. **Developer integration:** Copy DID for app integration

---

## Implementation Notes

### Components

**Simple Profile:**
- `ProfilePage.tsx` (main route handler)
- `SimpleProofCard.tsx` (LinkTree-style account card)

**Technical Details:**
- `ProfileDetailsPage.tsx` (main route handler)
- `DetailedProofCard.tsx` (full technical proof card with replay/server verification)
- `KeyCard.tsx` (public key display with fingerprint)
- `StatementCard.tsx` (signed statement display)
- `ProofReplayVerification.tsx` (client-side verification UI)
- `ServerVerificationBadge.tsx` (server cache status)
- `VerificationReport.tsx` (export functionality)

### Shared Data Fetching
Both routes use the same API endpoint:
```
GET /api/profile/:identifier
```

Returns:
```json
{
  "did": "did:plc:abc123xyz",
  "handle": "alice.bsky.social",
  "displayName": "Alice Henderson",
  "avatar": "https://...",
  "proofs": [...],
  "keys": [...],
  "statements": [...]
}
```

The difference is **how the data is displayed**, not what data is fetched.

---

## Design Philosophy

**Simple Profile:**
- "Show me your credentials like a business card"
- Optimize for trust at a glance
- No learning curve required
- Mobile-first, minimal design
- Target: **99% of visitors**

**Technical Details:**
- "Show me the receipts"
- Optimize for transparency and verifiability
- Assume technical knowledge
- Desktop-optimized, information-dense
- Target: **1% of visitors (but critical for trust)**

Both views serve the same underlying goal: **prove your identity across services**. The simple view makes it accessible; the detailed view makes it trustworthy.
