# Phase 4: Profile & Verification UI — Detailed Implementation Guide

**Objective:** Build two distinct profile views (simple LinkTree-style and detailed technical view), implement proof/key display with status badges, and add client-side proof re-verification.

**Prerequisites:**
- Phase 1 completed (lexicons, AT Proto library, API routes)
- Phase 2 completed (proof/wallet verification)
- Phase 3 completed (keys, sign & verify)

---

## Overview: Two Profile Views

AttestFor.me provides **two distinct profile routes** to serve different audiences:

1. **Simple Profile** (`/:handle`) — LinkTree-style interface for non-technical users
   - Clean, minimal design with large account cards
   - Shows verified accounts with visual checkmarks
   - No technical jargon, DIDs, or cryptographic details
   - Target: General users, recruiters, collaborators

2. **Technical Details Profile** (`/:handle/details`) — Full verification dashboard
   - Shows DID, public keys, detailed proof information
   - Client-side replay verification
   - Export capabilities and re-verification actions
   - Target: Developers, security researchers, auditors

---

## Architecture Decisions

These decisions were made based on the actual codebase as of Phase 3:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data fetching | Client-side via existing helpers | `src/lib/atproto.ts` already has `listProofs()`, `listKeys()` — no new server endpoint needed |
| Server verification | Not included | All verification is client-side via `src/lib/verifiers/` — no server-side verifier infrastructure |
| Statements | Deferred | No statement creation flow exists yet — will add when the creation flow is built |
| Verification reports | Not included | Will be added in a future phase |
| Background re-verification | Not included | Production concern, not needed for Phase 4 |
| Re-verification | Client-side only | `ProofReplayVerification` runs existing browser verifiers (`GitHubVerifier`, `TwitterVerifier`) |
| Proof/key data | Stubbed | No proof creation wizard exists yet — stub with empty data, design around empty states |
| Styling | Tailwind CSS v4 | Project uses Tailwind v4 with `@tailwindcss/vite`, custom theme tokens in `src/colors.css` |
| Routing | React Router v7 loaders | Matches existing `ProfilePage` pattern (`LoaderFunctionArgs` → `useLoaderData`) |
| Server framework | Fastify | No new server routes in this phase, but noted for consistency |
| AT Proto client | `@atcute/*` ecosystem | Project uses `@atcute/client`, NOT `@atproto/api` |

---

## Existing Code Reference

### Current `ProfilePage.tsx` (to be extended)

The existing page uses a React Router loader, fetches from `getProfile()` in `src/lib/bsky.ts`, and renders avatar/name/handle/bio. Phase 4 extends this — it does **not** replace it.

### Available helpers in `src/lib/atproto.ts`

```typescript
// Public reads (no auth) — these are what the profile pages will use
listProofs(did: string): Promise<AtProtoRecord<MeAttestProof.Main>[]>
listKeys(did: string): Promise<AtProtoRecord<MeAttestKey.Main>[]>
getProof(did: string, rkey: string): Promise<AtProtoRecord<MeAttestProof.Main>>
getKey(did: string, rkey: string): Promise<AtProtoRecord<MeAttestKey.Main>>
parseAtUri(uri: string): { repo: string; collection: string; rkey: string }
```

### Available helpers in `src/lib/bsky.ts`

```typescript
getProfile(actor: string): Promise<BskyProfile | null>     // returns did, handle, displayName, description, avatar
resolveHandle(handle: string): Promise<string | null>       // handle → DID
```

### Existing verifiers in `src/lib/verifiers/`

```typescript
// BaseProofVerifier interface
abstract verify(proofUrl: string, expectedChallenge: string, handle: string): Promise<VerificationResult>
abstract validateProofUrl(proofUrl: string): boolean
abstract normalizeHandle(handle: string): string
abstract getServiceName(): string

// Concrete verifiers
GitHubVerifier   // verifies GitHub gist proofs
TwitterVerifier  // verifies Twitter tweet proofs (via /api/twitter/tweet proxy)
```

### Lexicon types

```typescript
// MeAttestProof.Main fields:
service: string             // "github" | "twitter" | ...
handle: string              // username on external service
proofUrl: string            // URL to proof (gist, tweet)
challengeText?: string      // full challenge text
nonce: string               // random nonce
createdAt: string           // ISO 8601
status?: "active" | "retracted"
retractedAt?: string        // ISO 8601

// MeAttestKey.Main fields:
keyType: string             // "pgp" | "ssh-ed25519" | "ssh-ecdsa"
publicKey: string           // full public key text
fingerprint?: string        // hex fingerprint
label?: string              // user-defined label
comment?: string            // optional description
createdAt: string           // ISO 8601
expiresAt?: string          // ISO 8601
status?: "active" | "revoked"
```

### Theme tokens (from `src/colors.css`)

```
--color-accent, --color-accent-hover, --color-accent-subtle
--color-surface, --color-surface-border, --color-input
--color-muted, --color-page
```

All styling must use Tailwind utility classes with these tokens (e.g. `bg-surface`, `text-muted`, `border-surface-border`).

---

## Task 4.1: Extend Simple Profile Page (LinkTree-Style)

### Location
Modify file: `src/pages/ProfilePage.tsx`

### Changes

1. **Extend the loader** to also resolve the handle to a DID via `getProfile()` (which already returns `did`), then fetch proofs and keys via `listProofs(did)` and `listKeys(did)` from `src/lib/atproto.ts`
2. **Extend the component** to render a verified accounts grid, verification summary, and footer with link to details page

### Implementation

```typescript
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { SimpleProofCard } from "@/components/Profile/SimpleProofCard";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";
import { listProofs, listKeys, type AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof, MeAttestKey } from "../../types/lexicons";

interface ProfileData {
  handle: string;
  did: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  isValid: boolean;
  proofs: AtProtoRecord<MeAttestProof.Main>[];
  keys: AtProtoRecord<MeAttestKey.Main>[];
}

// eslint-disable-next-line react-refresh/only-export-components
export async function profileLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", did: "", isValid: false, proofs: [], keys: [] };
  }

  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Skip requests for static files that hit the /:handle route
  if (
    /\.(ico|png|jpg|jpeg|svg|webp|gif|js|css|map|json|txt|xml|webmanifest)$/i.test(
      cleanHandle,
    )
  ) {
    return { handle: cleanHandle, did: "", isValid: false, proofs: [], keys: [] };
  }

  try {
    const profile = await getProfile(cleanHandle);
    if (!profile) {
      return { handle: cleanHandle, did: "", isValid: false, proofs: [], keys: [] };
    }

    // Fetch proofs and keys in parallel using the DID
    const [proofs, keys] = await Promise.all([
      listProofs(profile.did).catch(() => []),
      listKeys(profile.did).catch(() => []),
    ]);

    return {
      handle: profile.handle,
      did: profile.did,
      displayName: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      isValid: true,
      proofs,
      keys,
    };
  } catch (error) {
    console.error("[ProfileLoader] Error fetching profile:", error);
    return { handle: cleanHandle, did: "", isValid: false, proofs: [], keys: [] };
  }
}

export function ProfilePage() {
  const profile = useLoaderData() as ProfileData;

  if (!profile.isValid) {
    return <NotFoundContent />;
  }

  const activeProofs = profile.proofs.filter(
    (p) => p.value.status !== "retracted",
  );

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${profile.displayName || profile.handle} on AttestFor.me`, url });
    } else {
      await navigator.clipboard.writeText(url);
      // TODO: toast notification
    }
  };

  return (
    <>
      {/* Profile Section */}
      <div className="flex flex-col items-center gap-6 max-w-xl mx-auto w-full">
        {/* Profile Picture */}
        {profile.avatar ? (
          <AvatarWithShimmer
            key={profile.avatar}
            src={profile.avatar}
            alt={profile.displayName || profile.handle}
          />
        ) : (
          <div className="w-30 h-30 bg-accent flex items-center justify-center text-4xl text-white font-bold shadow-lg shadow-accent-subtle">
            {profile.handle[0].toUpperCase()}
          </div>
        )}

        {/* Profile Info */}
        <div className="text-center">
          <h1 className="text-2xl m-0 mb-1">
            {profile.displayName || `@${profile.handle}`}
          </h1>
          {profile.displayName && (
            <div className="text-sm text-muted m-0 mb-3">@{profile.handle}</div>
          )}
          {profile.description && (
            <div className="text-sm leading-relaxed text-muted m-0">
              {profile.description}
            </div>
          )}
        </div>

        {/* Verification Summary */}
        {activeProofs.length > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 text-sm font-semibold">
            <span>✓</span>
            <span>
              {activeProofs.length} verified {activeProofs.length === 1 ? "account" : "accounts"}
            </span>
          </div>
        )}

        {/* Verified Accounts Grid */}
        {activeProofs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {activeProofs.map((proof) => (
              <SimpleProofCard key={proof.uri} proof={proof} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-lg mb-1">No verified accounts yet</p>
            <p className="text-sm">
              This user hasn't linked any external accounts.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-3 mt-6 pt-6 border-t border-surface-border w-full">
          <Link
            to={`/${profile.handle}/details`}
            className="text-accent font-semibold hover:underline"
          >
            View technical details →
          </Link>
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-lg border border-surface-border bg-surface text-sm cursor-pointer hover:border-muted transition-colors"
          >
            Share profile
          </button>
        </div>
      </div>
    </>
  );
}
```

---

## Task 4.2: Simple Proof Card Component

### Location
Create file: `src/components/Profile/SimpleProofCard.tsx`

### Implementation

```typescript
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../../types/lexicons";

interface SimpleProofCardProps {
  proof: AtProtoRecord<MeAttestProof.Main>;
}

const SERVICE_ICONS: Record<string, string> = {
  github: "🐙",
  twitter: "🐦",
};

const SERVICE_NAMES: Record<string, string> = {
  github: "GitHub",
  twitter: "Twitter / X",
};

function getTargetUrl(proof: MeAttestProof.Main): string | undefined {
  switch (proof.service) {
    case "github":
      return `https://github.com/${proof.handle}`;
    case "twitter":
      return `https://x.com/${proof.handle.replace(/^@/, "")}`;
    default:
      return undefined;
  }
}

export function SimpleProofCard({ proof }: SimpleProofCardProps) {
  const { value } = proof;
  const icon = SERVICE_ICONS[value.service] || "🔗";
  const serviceName = SERVICE_NAMES[value.service] || value.service;
  const targetUrl = getTargetUrl(value);
  const isActive = value.status !== "retracted";

  const content = (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
        isActive
          ? "border-green-500/40 bg-green-500/5 hover:shadow-green-500/10"
          : "border-yellow-500/40 bg-yellow-500/5 hover:shadow-yellow-500/10"
      }`}
    >
      {/* Service Icon */}
      <span className="text-3xl shrink-0">{icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-sm">{serviceName}</div>
        <div className="text-muted text-sm truncate">{value.handle}</div>
      </div>

      {/* Status Badge */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
          isActive
            ? "bg-green-500 text-white"
            : "bg-yellow-500 text-white"
        }`}
      >
        {isActive ? "✓" : "⚠"}
      </div>
    </div>
  );

  if (targetUrl) {
    return (
      <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="no-underline text-inherit">
        {content}
      </a>
    );
  }

  return content;
}
```

---

## Task 4.3: Technical Details Profile Page

### Location
Create file: `src/pages/ProfileDetailsPage.tsx`

### Implementation

```typescript
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { DetailedProofCard } from "@/components/Profile/DetailedProofCard";
import { KeyCard } from "@/components/Profile/KeyCard";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";
import { listProofs, listKeys, type AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof, MeAttestKey } from "../../types/lexicons";

interface ProfileDetailsData {
  handle: string;
  did: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  isValid: boolean;
  proofs: AtProtoRecord<MeAttestProof.Main>[];
  keys: AtProtoRecord<MeAttestKey.Main>[];
}

// eslint-disable-next-line react-refresh/only-export-components
export async function profileDetailsLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileDetailsData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", did: "", isValid: false, proofs: [], keys: [] };
  }

  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  try {
    const profile = await getProfile(cleanHandle);
    if (!profile) {
      return { handle: cleanHandle, did: "", isValid: false, proofs: [], keys: [] };
    }

    const [proofs, keys] = await Promise.all([
      listProofs(profile.did).catch(() => []),
      listKeys(profile.did).catch(() => []),
    ]);

    return {
      handle: profile.handle,
      did: profile.did,
      displayName: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      isValid: true,
      proofs,
      keys,
    };
  } catch (error) {
    console.error("[ProfileDetailsLoader] Error fetching profile:", error);
    return { handle: cleanHandle, did: "", isValid: false, proofs: [], keys: [] };
  }
}

export function ProfileDetailsPage() {
  const profile = useLoaderData() as ProfileDetailsData;
  const [activeTab, setActiveTab] = useState<"proofs" | "keys">("proofs");
  const [copiedDid, setCopiedDid] = useState(false);

  if (!profile.isValid) {
    return <NotFoundContent />;
  }

  const activeProofs = profile.proofs.filter(
    (p) => p.value.status !== "retracted",
  );
  const activeKeys = profile.keys.filter(
    (k) => k.value.status !== "revoked",
  );

  const copyDid = async () => {
    await navigator.clipboard.writeText(profile.did);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          to={`/${profile.handle}`}
          className="text-accent text-sm font-semibold hover:underline"
        >
          ← Simple view
        </Link>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8 pb-8 border-b-2 border-surface-border">
        {/* Avatar */}
        <div className="shrink-0 self-center sm:self-start">
          {profile.avatar ? (
            <AvatarWithShimmer
              key={profile.avatar}
              src={profile.avatar}
              alt={profile.displayName || profile.handle}
            />
          ) : (
            <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center text-3xl text-white font-bold">
              {profile.handle[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl m-0 mb-1">
            {profile.displayName || `@${profile.handle}`}
          </h1>
          {profile.displayName && (
            <p className="text-muted m-0 mb-4">@{profile.handle}</p>
          )}

          {/* DID */}
          <div className="p-3 bg-surface rounded-lg border border-surface-border mb-4">
            <label className="block text-xs font-semibold text-muted mb-1">
              Decentralized Identifier (DID)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono break-all p-2 bg-page rounded border border-surface-border">
                {profile.did}
              </code>
              <button
                onClick={copyDid}
                className="shrink-0 px-3 py-1.5 text-xs border border-surface-border rounded bg-surface hover:bg-page transition-colors cursor-pointer"
              >
                {copiedDid ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm text-muted">
            <span>
              <strong className="text-white">{activeProofs.length}</strong>{" "}
              {activeProofs.length === 1 ? "proof" : "proofs"}
            </span>
            <span>
              <strong className="text-white">{activeKeys.length}</strong>{" "}
              {activeKeys.length === 1 ? "key" : "keys"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b-2 border-surface-border">
        <button
          onClick={() => setActiveTab("proofs")}
          className={`px-4 py-3 text-sm font-semibold border-b-3 -mb-0.5 transition-colors cursor-pointer bg-transparent ${
            activeTab === "proofs"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-white"
          }`}
        >
          Proofs ({activeProofs.length})
        </button>
        <button
          onClick={() => setActiveTab("keys")}
          className={`px-4 py-3 text-sm font-semibold border-b-3 -mb-0.5 transition-colors cursor-pointer bg-transparent ${
            activeTab === "keys"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-white"
          }`}
        >
          Keys ({activeKeys.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "proofs" && (
        <div className="flex flex-col gap-4">
          {activeProofs.length > 0 ? (
            activeProofs.map((proof) => (
              <DetailedProofCard key={proof.uri} proof={proof} />
            ))
          ) : (
            <div className="text-center py-12 text-muted">
              <p className="text-lg mb-1">No proofs found</p>
              <p className="text-sm">
                This user hasn't published any identity proofs yet.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "keys" && (
        <div className="flex flex-col gap-4">
          {activeKeys.length > 0 ? (
            activeKeys.map((key) => (
              <KeyCard key={key.uri} keyRecord={key} />
            ))
          ) : (
            <div className="text-center py-12 text-muted">
              <p className="text-lg mb-1">No keys published</p>
              <p className="text-sm">
                This user hasn't published any public keys yet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.4: Detailed Proof Card Component

### Location
Create file: `src/components/Profile/DetailedProofCard.tsx`

### Implementation

```typescript
import { useState } from "react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../../types/lexicons";
import { ProofReplayVerification } from "./ProofReplayVerification";

interface DetailedProofCardProps {
  proof: AtProtoRecord<MeAttestProof.Main>;
}

const SERVICE_ICONS: Record<string, string> = {
  github: "🐙",
  twitter: "🐦",
};

const SERVICE_NAMES: Record<string, string> = {
  github: "GitHub",
  twitter: "Twitter / X",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DetailedProofCard({ proof }: DetailedProofCardProps) {
  const { value } = proof;
  const [expanded, setExpanded] = useState(false);

  const icon = SERVICE_ICONS[value.service] || "🔗";
  const serviceName = SERVICE_NAMES[value.service] || value.service;
  const isActive = value.status !== "retracted";

  return (
    <div
      className={`rounded-lg border p-4 transition-shadow hover:shadow-md ${
        isActive
          ? "border-l-4 border-l-green-500 border-surface-border"
          : "border-l-4 border-l-red-500 border-surface-border opacity-70"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold">{serviceName}</span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isActive
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isActive ? "✓ Active" : "✗ Retracted"}
        </span>
      </div>

      {/* Identity */}
      <p className="text-sm mb-1">
        <span className="text-muted">Handle:</span>{" "}
        <span className="font-medium">{value.handle}</span>
      </p>

      {/* Proof URL */}
      {value.proofUrl && (
        <p className="text-sm mb-1">
          <span className="text-muted">Proof:</span>{" "}
          <a
            href={value.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline text-xs break-all"
          >
            {value.proofUrl}
          </a>
        </p>
      )}

      {/* Dates */}
      <div className="flex gap-4 text-xs text-muted mt-2">
        <span>Created: {formatDate(value.createdAt)}</span>
        {value.retractedAt && (
          <span>Retracted: {formatDate(value.retractedAt)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-accent bg-transparent border-none cursor-pointer hover:underline p-0"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <dl className="text-xs space-y-3">
            <div>
              <dt className="font-semibold text-muted mb-0.5">Record URI</dt>
              <dd className="font-mono break-all bg-page p-2 rounded border border-surface-border">
                {proof.uri}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-muted mb-0.5">CID</dt>
              <dd className="font-mono break-all bg-page p-2 rounded border border-surface-border">
                {proof.cid}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-muted mb-0.5">Nonce</dt>
              <dd className="font-mono bg-page p-2 rounded border border-surface-border">
                {value.nonce}
              </dd>
            </div>
            {value.challengeText && (
              <div>
                <dt className="font-semibold text-muted mb-0.5">Challenge Text</dt>
                <dd className="font-mono whitespace-pre-wrap bg-page p-2 rounded border border-surface-border">
                  {value.challengeText}
                </dd>
              </div>
            )}
          </dl>

          {/* Client-Side Re-Verification */}
          {isActive && (
            <div className="mt-4">
              <ProofReplayVerification proof={proof} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.5: Key Card Component

### Location
Create file: `src/components/Profile/KeyCard.tsx`

### Implementation

```typescript
import { useState } from "react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestKey } from "../../../types/lexicons";

interface KeyCardProps {
  keyRecord: AtProtoRecord<MeAttestKey.Main>;
}

const KEY_ICONS: Record<string, string> = {
  pgp: "🔐",
  "ssh-ed25519": "🔑",
  "ssh-ecdsa": "🔑",
};

const KEY_TYPE_LABELS: Record<string, string> = {
  pgp: "PGP / GPG",
  "ssh-ed25519": "SSH Ed25519",
  "ssh-ecdsa": "SSH ECDSA",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function KeyCard({ keyRecord }: KeyCardProps) {
  const { value } = keyRecord;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const icon = KEY_ICONS[value.keyType] || "🔑";
  const typeLabel = KEY_TYPE_LABELS[value.keyType] || value.keyType;
  const isExpired = value.expiresAt && new Date(value.expiresAt) < new Date();
  const isRevoked = value.status === "revoked";

  const copyPublicKey = async () => {
    await navigator.clipboard.writeText(value.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-lg border border-surface-border p-4 ${
        isExpired || isRevoked ? "opacity-60 border-l-4 border-l-yellow-500" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold">{typeLabel}</span>
          {value.label && (
            <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">
              {value.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRevoked && (
            <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-semibold">
              Revoked
            </span>
          )}
          {isExpired && !isRevoked && (
            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-semibold">
              Expired
            </span>
          )}
        </div>
      </div>

      {/* Fingerprint */}
      {value.fingerprint && (
        <div className="text-xs mb-2">
          <span className="text-muted">Fingerprint:</span>{" "}
          <code className="font-mono bg-page px-1.5 py-0.5 rounded border border-surface-border break-all">
            {value.fingerprint}
          </code>
        </div>
      )}

      {/* Comment */}
      {value.comment && (
        <p className="text-sm text-muted mb-2">{value.comment}</p>
      )}

      {/* Dates */}
      <div className="flex gap-4 text-xs text-muted">
        <span>Published: {formatDate(value.createdAt)}</span>
        {value.expiresAt && (
          <span className={isExpired ? "text-yellow-400 font-semibold" : ""}>
            {isExpired ? "Expired" : "Expires"}: {formatDate(value.expiresAt)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-accent bg-transparent border-none cursor-pointer hover:underline p-0"
        >
          {expanded ? "Hide public key" : "Show public key"}
        </button>
        <button
          onClick={copyPublicKey}
          className="text-xs text-accent bg-transparent border-none cursor-pointer hover:underline p-0"
        >
          {copied ? "Copied!" : "Copy public key"}
        </button>
      </div>

      {/* Expanded Key Content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-page p-3 rounded border border-surface-border overflow-x-auto max-h-64 overflow-y-auto">
            {value.publicKey}
          </pre>
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.6: Client-Side Proof Replay Verification Component

### Location
Create file: `src/components/Profile/ProofReplayVerification.tsx`

### Purpose

This component runs the existing client-side verifiers (`GitHubVerifier`, `TwitterVerifier` from `src/lib/verifiers/`) directly in the browser. It fetches the proof URL, checks for the challenge text, and displays a step-by-step result. No server calls are made for the verification itself (Twitter verification still uses the existing `/api/twitter/tweet` proxy for CORS).

### Implementation

```typescript
import { useState } from "react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../../types/lexicons";
import { GitHubVerifier } from "@/lib/verifiers/github";
import { TwitterVerifier } from "@/lib/verifiers/twitter";
import type { BaseProofVerifier, VerificationResult } from "@/lib/verifiers/base-verifier";

interface ProofReplayVerificationProps {
  proof: AtProtoRecord<MeAttestProof.Main>;
}

interface VerificationStep {
  step: string;
  status: "success" | "error" | "pending";
  message: string;
}

const VERIFIERS: Record<string, () => BaseProofVerifier> = {
  github: () => new GitHubVerifier(),
  twitter: () => new TwitterVerifier(),
};

export function ProofReplayVerification({ proof }: ProofReplayVerificationProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [steps, setSteps] = useState<VerificationStep[]>([]);

  const { value } = proof;
  const hasVerifier = value.service in VERIFIERS;

  const handleReplay = async () => {
    if (!hasVerifier) return;

    setVerifying(true);
    setResult(null);
    setSteps([]);

    const currentSteps: VerificationStep[] = [];

    const addStep = (step: string, status: VerificationStep["status"], message: string) => {
      currentSteps.push({ step, status, message });
      setSteps([...currentSteps]);
    };

    const updateLastStep = (status: VerificationStep["status"], message: string) => {
      const last = currentSteps[currentSteps.length - 1];
      currentSteps[currentSteps.length - 1] = { ...last, status, message };
      setSteps([...currentSteps]);
    };

    try {
      // Step 1: Validate proof URL
      addStep("Validate URL", "pending", "Checking proof URL format...");
      const verifier = VERIFIERS[value.service]();
      const urlValid = verifier.validateProofUrl(value.proofUrl);

      if (!urlValid) {
        updateLastStep("error", "Invalid proof URL format");
        setResult({ success: false, error: "Invalid proof URL format", errorCode: "INVALID_URL" });
        return;
      }
      updateLastStep("success", "Proof URL format is valid");

      // Step 2: Check handle
      addStep("Check handle", "pending", "Validating handle...");
      const normalizedHandle = verifier.normalizeHandle(value.handle);
      updateLastStep("success", `Handle: ${normalizedHandle}`);

      // Step 3: Fetch and verify
      addStep("Verify proof", "pending", "Fetching proof content and verifying...");
      const challengeText = value.challengeText || "";
      const verificationResult = await verifier.verify(
        value.proofUrl,
        challengeText,
        value.handle,
      );

      updateLastStep(
        verificationResult.success ? "success" : "error",
        verificationResult.success
          ? "Challenge text found and verified"
          : verificationResult.error || "Verification failed",
      );
      setResult(verificationResult);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addStep("Error", "error", message);
      setResult({ success: false, error: message, errorCode: "UNKNOWN_ERROR" });
    } finally {
      setVerifying(false);
    }
  };

  if (!hasVerifier) {
    return (
      <div className="text-xs text-muted">
        No verifier available for {value.service}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleReplay}
        disabled={verifying}
        className="px-3 py-1.5 text-xs font-semibold rounded bg-accent text-white border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying ? "Verifying…" : "Replay verification"}
      </button>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5">
                {step.status === "success" && "✅"}
                {step.status === "error" && "❌"}
                {step.status === "pending" && "⏳"}
              </span>
              <div>
                <span className="font-semibold">{step.step}:</span>{" "}
                <span className="text-muted">{step.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Final Result */}
      {result && !verifying && (
        <div
          className={`mt-3 p-3 rounded text-xs font-semibold ${
            result.success
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {result.success ? "✓ Proof is valid" : `✗ Proof is invalid: ${result.error}`}
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.7: Route Registration

### Location
Modify file: `src/routes.tsx`

### Implementation

```typescript
import type { RouteObject } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage, profileLoader } from "./pages/ProfilePage";
import {
  ProfileDetailsPage,
  profileDetailsLoader,
} from "./pages/ProfileDetailsPage";
import { SignVerifyPage } from "./pages/SignVerifyPage";
import { PageLayout } from "./components/PageLayout";
import "./index.css";

export const routes: RouteObject[] = [
  {
    element: <PageLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/sign-verify",
        element: <SignVerifyPage />,
      },
      {
        path: "/:handle",
        element: <ProfilePage />,
        loader: profileLoader,
      },
      {
        path: "/:handle/details",
        element: <ProfileDetailsPage />,
        loader: profileDetailsLoader,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];
```

**Route behavior:**
- `/:handle` — Simple LinkTree-style profile (default, public-facing)
- `/:handle/details` — Technical details profile (advanced, power users)
- Navigation between them is client-side (React Router), no full page reload

---

## File Changes Summary

```
src/
  routes.tsx                              # MODIFIED: add /:handle/details route
  pages/
    ProfilePage.tsx                       # MODIFIED: extend with proofs grid, summary, footer
    ProfileDetailsPage.tsx                # NEW: technical details page with tabs
  components/
    Profile/
      SimpleProofCard.tsx                 # NEW: LinkTree-style card for simple view
      DetailedProofCard.tsx               # NEW: expandable proof card with re-verify
      KeyCard.tsx                         # NEW: key display with fingerprint + copy
      ProofReplayVerification.tsx         # NEW: client-side step-by-step verifier UI
```

**No server files modified or created.**

---

## What Is NOT Included (and Why)

| Excluded | Reason |
|----------|--------|
| `server/routes/profile.ts` | No server endpoint needed — client fetches via existing `src/lib/atproto.ts` helpers |
| `ServerVerificationBadge` component | No server-side verification — all verification is client-side |
| `StatementCard` component | No statement creation flow exists yet — deferred to a future phase |
| Statements tab on details page | Same as above |
| `VerificationReport` component | Skipped for Phase 4 |
| `POST /api/profile/:did/report` endpoint | Skipped for Phase 4 |
| `POST /api/proofs/reverify` endpoint | Re-verification is client-side only via `ProofReplayVerification` |
| `server/lib/reverification-scheduler.ts` | Production concern — not needed for Phase 4 |
| Raw CSS class blocks | Project uses Tailwind v4 — all styling via utility classes |
| `@atproto/api` / `AtpAgent` | Not in project dependencies — uses `@atcute/*` ecosystem and `src/lib/atproto.ts` |
| Express patterns (`Router`, `Request`, `Response`) | Project uses Fastify — no server code in this phase anyway |
| `server/lib/atproto-repo.ts` imports | File was deleted in Phase 2 — replaced by `src/lib/atproto.ts` |
| `useParams` + `useEffect` data fetching | Project uses React Router v7 loaders with `useLoaderData` |

---

## Acceptance Criteria

Phase 4 is complete when:

**Profile Routes & Views:**
- [ ] Simple profile route (`/:handle`) shows LinkTree-style layout with avatar, name, bio
- [ ] Technical details route (`/:handle/details`) shows DID, proofs tab, keys tab
- [ ] Simple profile shows verified accounts grid with visual checkmarks
- [ ] Technical details profile shows DID prominently with copy button
- [ ] Navigation between simple and details views works (React Router, no full reload)
- [ ] Simple profile hides all technical jargon (no DIDs, nonces, CIDs, etc.)
- [ ] Details profile shows challenge text, nonce, record URI, CID in expandable sections

**Proof Display:**
- [ ] `SimpleProofCard` displays service icon, handle, and active/retracted status
- [ ] `SimpleProofCard` links to actual external service profile (GitHub, Twitter)
- [ ] `DetailedProofCard` shows full proof information with expandable details
- [ ] Proof status badges display correctly (✓ active, ✗ retracted)
- [ ] `ProofReplayVerification` runs client-side verifiers in browser
- [ ] `ProofReplayVerification` shows step-by-step verification result (URL validation, handle check, content verification)
- [ ] Verification result clearly shows ✓ valid or ✗ invalid with error message

**Key Display:**
- [ ] `KeyCard` displays key type icon, label, fingerprint, and expiration status
- [ ] `KeyCard` expand/collapse shows full public key text
- [ ] Copy public key button works
- [ ] Expired and revoked keys are visually dimmed

**Empty States:**
- [ ] Simple profile with no proofs shows "No verified accounts yet" message
- [ ] Details proofs tab with no proofs shows "No proofs found" message
- [ ] Details keys tab with no keys shows "No keys published" message

**Technical Requirements:**
- [ ] All styling uses Tailwind v4 utility classes with project theme tokens
- [ ] Both pages use React Router v7 loaders (`LoaderFunctionArgs` → `useLoaderData`)
- [ ] Data fetched via `listProofs()` / `listKeys()` from `src/lib/atproto.ts`
- [ ] TypeScript strict mode — 0 type errors
- [ ] ESLint clean — 0 lint errors
- [ ] All existing tests still pass (72 tests)

---

## Next Phase

Proceed to **Phase 5: Web of Trust** after all acceptance criteria are met.
