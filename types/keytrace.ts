/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Type-only re-exports of @keytrace/lexicon interfaces.
 *
 * The upstream package ships .ts source files that depend on @atproto/lexicon
 * (different SDK to the @atcute/* stack this project uses). Instead of pulling
 * in @atproto/* at runtime we mirror the *interfaces only* here so every
 * import in the codebase stays in @atcute-land.
 *
 * When @keytrace/lexicon publishes compiled .d.ts files we can drop this shim
 * and import from the package directly.
 *
 * Source of truth: node_modules/@keytrace/lexicon/types/types/dev/keytrace/*.ts
 */

// ── Lexicon NSID constants ─────────────────────────────────────────

export const ids = {
  DevKeytraceClaim: "dev.keytrace.claim",
  DevKeytraceProfile: "dev.keytrace.profile",
  DevKeytraceStatement: "dev.keytrace.statement",
  DevKeytraceUserPublicKey: "dev.keytrace.userPublicKey",
  DevKeytraceSignature: "dev.keytrace.signature",
  DevKeytraceServerPublicKey: "dev.keytrace.serverPublicKey",
  DevKeytraceRecipe: "dev.keytrace.recipe",
} as const;

// ── dev.keytrace.signature (embedded object, not a record) ─────────
// NOTE: Signatures are created by server-side verification services only.
// The client publishes claims with `sigs: []`; the server fills them in.

export namespace DevKeytraceSignature {
  /** A cryptographic signature attesting to a claim */
  export interface Main {
    $type?: "dev.keytrace.signature";
    /** Key identifier (e.g., date in YYYY-MM-DD format). */
    kid: string;
    /** AT URI reference to the signing key record. */
    src: string;
    /** Datetime when the signature was created (ISO 8601). */
    signedAt: string;
    /** The cryptographic signature (base64-encoded). */
    attestation: string;
    /** Ordered list of field names included in the signed payload. */
    signedFields: string[];
    /** Datetime when this signature was retracted (ISO 8601). */
    retractedAt?: string;
    /** Optional comment. */
    comment?: string;
    [k: string]: unknown;
  }
}

// ── dev.keytrace.claim (record, key: tid) ──────────────────────────

export namespace DevKeytraceClaim {
  export interface Main {
    $type: "dev.keytrace.claim";
    /** The claim type identifier */
    type:
      | "github"
      | "dns"
      | "mastodon"
      | "twitter"
      | "website"
      | "pgp"
      | (string & {});
    /** The identity claim URI */
    claimUri: string;
    identity: Identity;
    /** One or more cryptographic attestation signatures. */
    sigs: DevKeytraceSignature.Main[];
    /** Optional user-provided label for this claim */
    comment?: string;
    /** Current verification status of this claim. */
    status?: "verified" | "failed" | "retracted" | (string & {});
    /** Timestamp of the most recent successful re-verification. */
    lastVerifiedAt?: string;
    /** Timestamp when the claim last failed re-verification. */
    failedAt?: string;
    /** Datetime when this claim was created (ISO 8601). */
    createdAt: string;
    /** Random nonce embedded in the challenge text. */
    nonce?: string;
    /** Whether this claim was created during the prerelease period. */
    prerelease?: boolean;
    /** Datetime when this claim was retracted (ISO 8601). */
    retractedAt?: string;
    [k: string]: unknown;
  }

  /** Alias used by upstream generated code */
  export type Record = Main;

  /** Generic identity data for the claimed account */
  export interface Identity {
    $type?: "dev.keytrace.claim#identity";
    /** Primary identifier (username, domain, handle, etc.) */
    subject: string;
    /** Avatar/profile image URL */
    avatarUrl?: string;
    /** Profile page URL */
    profileUrl?: string;
    /** Display name if different from subject */
    displayName?: string;
  }
}

// ── dev.keytrace.profile (record, key: literal:self) ───────────────

export namespace DevKeytraceProfile {
  export interface Main {
    $type: "dev.keytrace.profile";
    /** Display name override. Falls back to Bluesky display name if absent. */
    displayName?: string;
    /** Bio or description. */
    bio?: string;
    createdAt?: string;
    [k: string]: unknown;
  }

  export type Record = Main;
}

// ── dev.keytrace.userPublicKey (record, key: tid) ──────────────────
// NOTE: upstream @keytrace/lexicon@0.0.11 has the lexicon JSON but no
// generated TS types for this record yet — we derive the interface from
// the JSON schema in node_modules/@keytrace/lexicon/lexicons/dev/keytrace/userPublicKey.json

export namespace DevKeytraceUserPublicKey {
  export interface Main {
    $type: "dev.keytrace.userPublicKey";
    /** Format of the public key. */
    keyType: "pgp" | "ssh-ed25519" | "ssh-ecdsa" | (string & {});
    /** Full public key in standard text armored format. */
    publicKeyArmored: string;
    /** Key fingerprint. */
    fingerprint?: string;
    /** Human-readable label (e.g., 'work laptop', 'signing key'). */
    label?: string;
    /** Optional comment or description. */
    comment?: string;
    /** Datetime when this key expires (ISO 8601). */
    expiresAt?: string;
    /** Datetime when this key was retracted (ISO 8601). */
    retractedAt?: string;
    /** Datetime when this key was created (ISO 8601). */
    createdAt: string;
    [k: string]: unknown;
  }

  export type Record = Main;
}

// ── dev.keytrace.statement (record, key: tid) ──────────────────────

export namespace DevKeytraceStatement {
  export interface Main {
    $type: "dev.keytrace.statement";
    /** The statement text that was signed. */
    content: string;
    /** Optional short subject or title. */
    subject?: string;
    /** AT URI of the userPublicKey record whose private key produced this sig. */
    keyRef: string;
    /** Cryptographic signature of the content field. */
    sig: string;
    /** Datetime when this statement was retracted (ISO 8601). */
    retractedAt?: string;
    /** Datetime when this statement was created (ISO 8601). */
    createdAt: string;
    [k: string]: unknown;
  }

  export type Record = Main;
}

// ── dev.keytrace.serverPublicKey (record, key: any — YYYY-MM-DD) ───
// NOTE: Server-side only. Published by the verification service, not the client.

export namespace DevKeytraceServerPublicKey {
  export interface Main {
    $type: "dev.keytrace.serverPublicKey";
    /** JWK public key as a JSON string (RFC 7517 format). */
    publicJwk: string;
    /** Datetime from which this key is valid (ISO 8601). */
    validFrom: string;
    /** Datetime until which this key is valid (ISO 8601). */
    validUntil: string;
    [k: string]: unknown;
  }

  export type Record = Main;
}

// ── dev.keytrace.recipe (record, key: any — kebab-case) ─────────────

export namespace DevKeytraceRecipe {
  export interface Main {
    $type: "dev.keytrace.recipe";
    /** Claim type identifier (e.g., 'github', 'dns', 'mastodon'). */
    type: string;
    /** Recipe version for breaking changes. */
    version: number;
    /** Human-readable name (e.g., 'GitHub Account'). */
    displayName: string;
    /** User-provided parameters needed for verification. */
    params?: Param[];
    /** User-facing instructions for making the claim. */
    instructions: Instructions;
    /** Machine-readable verification steps. */
    verification: Verification;
    [k: string]: unknown;
  }

  export type Record = Main;

  export interface Param {
    /** Parameter key used in templates (e.g., 'gistUrl', 'domain'). */
    key: string;
    /** Human-readable label (e.g., 'Gist URL', 'Domain name'). */
    label: string;
    /** Input type for validation. */
    type: "url" | "text" | "domain" | (string & {});
    /** Placeholder text for the input. */
    placeholder?: string;
    /** Regex pattern to validate input. */
    pattern?: string;
    /** Regex with capture group to extract subject from param. */
    extractFrom?: string;
  }

  export interface Instructions {
    /** Ordered steps the user must follow. */
    steps: string[];
    /** Template for proof content. Supports {claimId}, {did}, {handle}, and param keys. */
    proofTemplate?: string;
    /** Where to place the proof (e.g., 'Create a public gist'). */
    proofLocation?: string;
  }

  export interface Verification {
    /** Machine-readable verification steps. */
    steps: VerificationStep[];
  }

  export interface VerificationStep {
    /** The action to perform. */
    action:
      | "http-get"
      | "http-paginate"
      | "css-select"
      | "json-path"
      | "regex-match"
      | "dns-txt"
      | (string & {});
    /** URL template with {user}, {claimId} placeholders. */
    url?: string;
    /** CSS selector or JSONPath expression. */
    selector?: string;
    /** Regex pattern to match. */
    pattern?: string;
    /** Pagination configuration. */
    pagination?: { nextUrl?: string; maxPages?: number };
    /** What to expect (e.g., 'contains:{claimId}'). */
    expect?: string;
  }
}
