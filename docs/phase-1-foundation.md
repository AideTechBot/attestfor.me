# Phase 1: Foundation — Detailed Implementation Guide

**Objective:** Establish the core infrastructure for AttestFor.me, including lexicon definitions, AT Protocol repository interaction, challenge generation, and basic API structure.

**Prerequisites:**
- Existing AT Protocol OAuth implementation (already present in the codebase)
- Node.js project with TypeScript
- Access to AT Protocol PDS API

---

## Task 1.1: Create Lexicon Schema Files

### Location
Create directory: `lexicons/me/attest/`

### File 1.1.1: `lexicons/me/attest/proof.json`

Create the proof lexicon with the following exact schema:

```json
{
  "lexicon": 1,
  "id": "me.attest.proof",
  "defs": {
    "main": {
      "type": "record",
      "description": "A proof of ownership of an external account or identity.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["service", "handle", "proofUrl", "nonce", "status", "createdAt"],
        "properties": {
          "service": {
            "type": "string",
            "description": "Canonical service identifier (e.g., 'twitter', 'github', 'bitcoin').",
            "knownValues": [
              "twitter",
              "github",
              "mastodon",
              "hackernews",
              "reddit",
              "lobsters",
              "gitlab",
              "keybase",
              "linkedin",
              "dns",
              "https",
              "fediverse",
              "bitcoin",
              "ethereum",
              "solana",
              "stellar",
              "monero",
              "cardano",
              "polkadot",
              "cosmos"
            ]
          },
          "handle": {
            "type": "string",
            "description": "The user's handle/username on the external service or wallet address.",
            "maxGraphemes": 512
          },
          "proofUrl": {
            "type": "string",
            "format": "uri",
            "description": "URL where the proof text can be found (tweet URL, gist URL, etc.). For wallet proofs, use format 'bitcoin://address'.",
            "maxGraphemes": 2048
          },
          "nonce": {
            "type": "string",
            "description": "Random nonce used in the proof challenge text (minimum 128 bits entropy).",
            "maxGraphemes": 128
          },
          "challengeText": {
            "type": "string",
            "description": "The full challenge text the user posted on the external service. For wallet proofs, this contains the cryptographic signature.",
            "maxGraphemes": 4096
          },
          "signature": {
            "type": "string",
            "description": "Optional: For wallet proofs, the cryptographic signature in hex or base64.",
            "maxGraphemes": 2048
          },
          "status": {
            "type": "string",
            "description": "Current status of this proof.",
            "default": "unverified",
            "enum": ["verified", "unverified", "revoked", "expired"]
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when this proof was created."
          },
          "verifiedAt": {
            "type": "string",
            "format": "datetime",
            "description": "Optional: ISO 8601 timestamp when this proof was last verified."
          },
          "lastCheckedAt": {
            "type": "string",
            "format": "datetime",
            "description": "Optional: ISO 8601 timestamp when this proof was last checked."
          },
          "errorMessage": {
            "type": "string",
            "description": "Optional: Error message if verification failed.",
            "maxGraphemes": 512
          },
          "serverVerification": {
            "type": "object",
            "description": "Optional: Server-side verification cache (24h TTL).",
            "properties": {
              "verifiedAt": {
                "type": "string",
                "format": "datetime",
                "description": "When server last verified this proof."
              },
              "result": {
                "type": "boolean",
                "description": "Server verification result."
              },
              "expiresAt": {
                "type": "string",
                "format": "datetime",
                "description": "When server verification cache expires (24h from verifiedAt)."
              }
            }
          }
          }
        }
      }
    }
  }
}
```

### File 1.1.2: `lexicons/me/attest/key.json`

Create the key lexicon:

```json
{
  "lexicon": 1,
  "id": "me.attest.key",
  "defs": {
    "main": {
      "type": "record",
      "description": "A published public key.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["keyType", "publicKey", "createdAt"],
        "properties": {
          "keyType": {
            "type": "string",
            "description": "Type of public key.",
            "knownValues": [
              "pgp",
              "ssh-rsa",
              "ssh-ed25519",
              "ssh-ecdsa",
              "age",
              "minisign",
              "signify",
              "wireguard",
              "fido2"
            ]
          },
          "fingerprint": {
            "type": "string",
            "description": "Key fingerprint. For PGP: 40-char hex (SHA-1 of public key). For SSH: SHA256 hash in standard format. For FIDO2: base64url-encoded credential ID.",
            "maxGraphemes": 256
          },
          "publicKey": {
            "type": "string",
            "description": "The full public key in standard text format (ASCII-armored PGP, OpenSSH format, etc.). For FIDO2: base64-encoded COSE public key.",
            "maxLength": 16384,
            "maxGraphemes": 16384
          },
          "label": {
            "type": "string",
            "description": "Human-readable label for this key (e.g., 'work laptop', 'signing key').",
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
            "description": "Optional expiration date (ISO 8601)."
          },
          "status": {
            "type": "string",
            "description": "Current status of this key.",
            "default": "active",
            "enum": ["active", "revoked"]
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when this key was published."
          }
        }
      }
    }
  }
}
```

### File 1.1.3: `lexicons/me/attest/profile.json`

Create the profile lexicon:

```json
{
  "lexicon": 1,
  "id": "me.attest.profile",
  "defs": {
    "main": {
      "type": "record",
      "description": "Attestation profile metadata.",
      "key": "literal:self",
      "record": {
        "type": "object",
        "properties": {
          "displayName": {
            "type": "string",
            "description": "Display name for the attestation profile.",
            "maxGraphemes": 128
          },
          "bio": {
            "type": "string",
            "description": "Biography or description.",
            "maxGraphemes": 1024
          },
          "website": {
            "type": "string",
            "format": "uri",
            "description": "Personal website URL.",
            "maxGraphemes": 512
          },
          "preferredKeyId": {
            "type": "string",
            "description": "Record key (rkey) of the preferred/primary public key from me.attest.key.",
            "maxGraphemes": 128
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when this profile was created."
          },
          "updatedAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when this profile was last updated."
          }
        }
      }
    }
  }
}
```

### File 1.1.4: `lexicons/me/attest/statement.json`

Create the statement lexicon:

```json
{
  "lexicon": 1,
  "id": "me.attest.statement",
  "defs": {
    "main": {
      "type": "record",
      "description": "A signed public statement or attestation.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["content", "createdAt"],
        "properties": {
          "content": {
            "type": "string",
            "description": "The statement text.",
            "maxLength": 10000,
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
            "items": {
              "type": "string",
              "maxGraphemes": 64
            },
            "maxLength": 10
          },
          "ref": {
            "type": "string",
            "format": "uri",
            "description": "Optional URI this statement references (e.g., a release URL, a document).",
            "maxGraphemes": 2048
          },
          "status": {
            "type": "string",
            "description": "Current status of this statement.",
            "default": "active",
            "enum": ["active", "retracted"]
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when this statement was created."
          },
          "retractedAt": {
            "type": "string",
            "format": "datetime",
            "description": "Optional: ISO 8601 timestamp when this statement was retracted."
          }
        }
      }
    }
  }
}
```

### File 1.1.5: `lexicons/me/attest/follow.json`

Create the follow lexicon:

```json
{
  "lexicon": 1,
  "id": "me.attest.follow",
  "defs": {
    "main": {
      "type": "record",
      "description": "A signed attestation that you have verified another user's identity proofs.",
      "key": "tid",
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
            "items": {
              "type": "string"
            },
            "maxLength": 100
          },
          "verifiedKeys": {
            "type": "array",
            "description": "List of key record keys (rkeys) that were verified at the time of following.",
            "items": {
              "type": "string"
            },
            "maxLength": 50
          },
          "comment": {
            "type": "string",
            "description": "Optional comment about the verification.",
            "maxGraphemes": 512
          },
          "verifiedAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when the verification was performed."
          },
          "status": {
            "type": "string",
            "description": "Current status of this follow.",
            "default": "active",
            "enum": ["active", "revoked"]
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "ISO 8601 timestamp when this follow record was created."
          },
          "revokedAt": {
            "type": "string",
            "format": "datetime",
            "description": "Optional: ISO 8601 timestamp when this follow was revoked."
          }
        }
      }
    }
  }
}
```

**Verification Steps:**
1. Validate all JSON files with a JSON schema validator
2. Ensure all `knownValues` and `enum` arrays contain unique values
3. Verify `maxGraphemes` and `maxLength` are reasonable for AT Protocol limits
4. Confirm `format` fields use valid formats: `datetime`, `uri`, `did`

---

## Task 1.2: Implement Challenge Generation

### Location
Create file: `server/lib/challenge.ts`

### Implementation

```typescript
import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random nonce
 * @param bits Minimum bits of entropy (default: 128)
 * @returns Base62-encoded nonce string
 */
export function generateNonce(bits: number = 128): string {
  const bytes = Math.ceil(bits / 8);
  const buffer = randomBytes(bytes);
  
  // Convert to base62 (alphanumeric)
  const base62Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  
  // Convert buffer to base62
  let num = BigInt('0x' + buffer.toString('hex'));
  while (num > 0n) {
    result = base62Chars[Number(num % 62n)] + result;
    num = num / 62n;
  }
  
  // Ensure minimum length
  const minLength = Math.ceil(bits * Math.log(2) / Math.log(62));
  while (result.length < minLength) {
    result = base62Chars[0] + result;
  }
  
  return result;
}

/**
 * Format challenge text for a proof
 * @param did User's DID
 * @param service Service name (e.g., 'twitter', 'github')
 * @param handle User's handle on the service
 * @param nonce Cryptographic nonce
 * @returns Formatted challenge text
 */
export function formatChallengeText(
  did: string,
  service: string,
  handle: string,
  nonce: string
): string {
  return `I am ${did} on AT Protocol.
Verifying my ${service} account ${handle} for attest.me.
Nonce: ${nonce}`;
}

/**
 * Format challenge text for wallet proofs
 * @param did User's DID
 * @param chain Blockchain name (e.g., 'ethereum', 'bitcoin')
 * @param address Wallet address
 * @param nonce Cryptographic nonce
 * @returns Formatted challenge text for wallet signing
 */
export function formatWalletChallengeText(
  did: string,
  chain: string,
  address: string,
  nonce: string
): string {
  return `I am ${did} on AT Protocol.
Verifying my ${chain} wallet ${address} for attest.me.
Nonce: ${nonce}`;
}

/**
 * Validate a nonce meets minimum entropy requirements
 * @param nonce The nonce to validate
 * @param minBits Minimum bits of entropy (default: 128)
 * @returns true if valid, false otherwise
 */
export function validateNonce(nonce: string, minBits: number = 128): boolean {
  if (!nonce || typeof nonce !== 'string') {
    return false;
  }
  
  // Base62 entropy: log2(62) ≈ 5.954 bits per character
  const minLength = Math.ceil(minBits / 5.954);
  if (nonce.length < minLength) {
    return false;
  }
  
  // Verify only base62 characters
  const base62Regex = /^[0-9A-Za-z]+$/;
  return base62Regex.test(nonce);
}

/**
 * Parse challenge text and extract components
 * @param challengeText The challenge text to parse
 * @returns Parsed components or null if invalid
 */
export function parseChallengeText(challengeText: string): {
  did: string;
  service: string;
  handle: string;
  nonce: string;
} | null {
  // Match pattern: "I am {did} on AT Protocol.\nVerifying my {service} account {handle} for attest.me.\nNonce: {nonce}"
  const pattern = /^I am (did:[a-z]+:[a-zA-Z0-9._:%-]+) on AT Protocol\.\nVerifying my ([a-z]+) (?:account|wallet) (.+) for attest\.me\.\nNonce: ([0-9A-Za-z]+)$/;
  
  const match = challengeText.match(pattern);
  if (!match) {
    return null;
  }
  
  return {
    did: match[1],
    service: match[2],
    handle: match[3],
    nonce: match[4],
  };
}
```

**Test Cases to Implement:**

Create file: `server/lib/challenge.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateNonce,
  formatChallengeText,
  formatWalletChallengeText,
  validateNonce,
  parseChallengeText,
} from './challenge';

describe('Challenge Generation', () => {
  describe('generateNonce', () => {
    it('should generate a nonce with default 128 bits', () => {
      const nonce = generateNonce();
      expect(nonce).toBeTruthy();
      expect(nonce.length).toBeGreaterThanOrEqual(22); // ceil(128/5.954) = 22
      expect(/^[0-9A-Za-z]+$/.test(nonce)).toBe(true);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set();
      for (let i = 0; i < 1000; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(1000);
    });

    it('should generate nonce with custom bit length', () => {
      const nonce = generateNonce(256);
      expect(nonce.length).toBeGreaterThanOrEqual(43); // ceil(256/5.954) = 43
    });
  });

  describe('formatChallengeText', () => {
    it('should format challenge text correctly', () => {
      const result = formatChallengeText(
        'did:plc:abc123',
        'twitter',
        '@alice',
        'R4nD0mN0nc3'
      );
      expect(result).toBe(
        'I am did:plc:abc123 on AT Protocol.\n' +
        'Verifying my twitter account @alice for attest.me.\n' +
        'Nonce: R4nD0mN0nc3'
      );
    });
  });

  describe('formatWalletChallengeText', () => {
    it('should format wallet challenge text correctly', () => {
      const result = formatWalletChallengeText(
        'did:plc:abc123',
        'ethereum',
        '0x1234...5678',
        'R4nD0mN0nc3'
      );
      expect(result).toBe(
        'I am did:plc:abc123 on AT Protocol.\n' +
        'Verifying my ethereum wallet 0x1234...5678 for attest.me.\n' +
        'Nonce: R4nD0mN0nc3'
      );
    });
  });

  describe('validateNonce', () => {
    it('should validate a good nonce', () => {
      expect(validateNonce('a'.repeat(22))).toBe(true);
    });

    it('should reject short nonce', () => {
      expect(validateNonce('short')).toBe(false);
    });

    it('should reject non-base62 characters', () => {
      expect(validateNonce('a'.repeat(20) + '!@')).toBe(false);
    });
  });

  describe('parseChallengeText', () => {
    it('should parse valid challenge text', () => {
      const text =
        'I am did:plc:abc123 on AT Protocol.\n' +
        'Verifying my twitter account @alice for attest.me.\n' +
        'Nonce: R4nD0mN0nc3';
      
      const result = parseChallengeText(text);
      expect(result).toEqual({
        did: 'did:plc:abc123',
        service: 'twitter',
        handle: '@alice',
        nonce: 'R4nD0mN0nc3',
      });
    });

    it('should parse wallet challenge text', () => {
      const text =
        'I am did:plc:abc123 on AT Protocol.\n' +
        'Verifying my ethereum wallet 0x1234 for attest.me.\n' +
        'Nonce: R4nD0mN0nc3';
      
      const result = parseChallengeText(text);
      expect(result).toEqual({
        did: 'did:plc:abc123',
        service: 'ethereum',
        handle: '0x1234',
        nonce: 'R4nD0mN0nc3',
      });
    });

    it('should return null for invalid text', () => {
      expect(parseChallengeText('invalid text')).toBeNull();
    });
  });
});
```

---

## Task 1.3: Build AT Proto Repo Interaction Library

### Location
Create file: `server/lib/atproto-repo.ts`

### Implementation

```typescript
import { AtpAgent } from '@atproto/api';

export interface AtProtoRepoClient {
  agent: AtpAgent;
  did: string;
}

/**
 * Create a record in the user's AT Proto repository
 * @param client Authenticated AT Proto client
 * @param collection The lexicon collection (e.g., 'me.attest.proof')
 * @param record The record data
 * @param rkey Optional record key (uses TID if not provided)
 * @returns The created record's URI and CID
 */
export async function createRecord(
  client: AtProtoRepoClient,
  collection: string,
  record: Record<string, any>,
  rkey?: string
): Promise<{ uri: string; cid: string }> {
  const response = await client.agent.com.atproto.repo.createRecord({
    repo: client.did,
    collection,
    rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Read a record from a user's AT Proto repository
 * @param agent AT Proto agent (can be unauthenticated for reading)
 * @param repo The repo DID
 * @param collection The lexicon collection
 * @param rkey The record key
 * @returns The record data
 */
export async function getRecord(
  agent: AtpAgent,
  repo: string,
  collection: string,
  rkey: string
): Promise<{ uri: string; cid: string; value: Record<string, any> }> {
  const response = await agent.com.atproto.repo.getRecord({
    repo,
    collection,
    rkey,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
    value: response.data.value as Record<string, any>,
  };
}

/**
 * List records from a collection in a user's repository
 * @param agent AT Proto agent
 * @param repo The repo DID
 * @param collection The lexicon collection
 * @param limit Maximum number of records to return
 * @param cursor Pagination cursor
 * @returns Array of records
 */
export async function listRecords(
  agent: AtpAgent,
  repo: string,
  collection: string,
  limit: number = 100,
  cursor?: string
): Promise<{
  records: Array<{ uri: string; cid: string; value: Record<string, any> }>;
  cursor?: string;
}> {
  const response = await agent.com.atproto.repo.listRecords({
    repo,
    collection,
    limit,
    cursor,
  });

  return {
    records: response.data.records.map((r) => ({
      uri: r.uri,
      cid: r.cid,
      value: r.value as Record<string, any>,
    })),
    cursor: response.data.cursor,
  };
}

/**
 * Update a record in the user's AT Proto repository
 * @param client Authenticated AT Proto client
 * @param uri The record URI (at://did/collection/rkey)
 * @param record The updated record data
 * @returns The updated record's URI and CID
 */
export async function updateRecord(
  client: AtProtoRepoClient,
  uri: string,
  record: Record<string, any>
): Promise<{ uri: string; cid: string }> {
  // Parse the URI
  const match = uri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }

  const [, repo, collection, rkey] = match;

  const response = await client.agent.com.atproto.repo.putRecord({
    repo,
    collection,
    rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Delete a record from the user's AT Proto repository
 * @param client Authenticated AT Proto client
 * @param uri The record URI
 */
export async function deleteRecord(
  client: AtProtoRepoClient,
  uri: string
): Promise<void> {
  const match = uri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }

  const [, repo, collection, rkey] = match;

  await client.agent.com.atproto.repo.deleteRecord({
    repo,
    collection,
    rkey,
  });
}

/**
 * Helper to extract rkey from AT URI
 * @param uri AT URI (at://did/collection/rkey)
 * @returns The record key
 */
export function extractRkey(uri: string): string {
  const match = uri.match(/^at:\/\/[^\/]+\/[^\/]+\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }
  return match[1];
}

/**
 * Helper to parse AT URI into components
 * @param uri AT URI
 * @returns Parsed components
 */
export function parseAtUri(uri: string): {
  repo: string;
  collection: string;
  rkey: string;
} {
  const match = uri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }

  return {
    repo: match[1],
    collection: match[2],
    rkey: match[3],
  };
}
```

**Test Cases:**

Create file: `server/lib/atproto-repo.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtpAgent } from '@atproto/api';
import {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
  deleteRecord,
  extractRkey,
  parseAtUri,
} from './atproto-repo';

describe('AT Proto Repo Library', () => {
  let mockAgent: AtpAgent;
  let client: { agent: AtpAgent; did: string };

  beforeEach(() => {
    mockAgent = {
      com: {
        atproto: {
          repo: {
            createRecord: vi.fn(),
            getRecord: vi.fn(),
            listRecords: vi.fn(),
            putRecord: vi.fn(),
            deleteRecord: vi.fn(),
          },
        },
      },
    } as any;

    client = {
      agent: mockAgent,
      did: 'did:plc:test123',
    };
  });

  describe('createRecord', () => {
    it('should create a record', async () => {
      const mockResponse = {
        data: {
          uri: 'at://did:plc:test123/me.attest.proof/abc123',
          cid: 'bafyreiabc123',
        },
      };

      vi.mocked(mockAgent.com.atproto.repo.createRecord).mockResolvedValue(mockResponse);

      const result = await createRecord(client, 'me.attest.proof', {
        service: 'twitter',
        handle: '@alice',
      });

      expect(result).toEqual({
        uri: 'at://did:plc:test123/me.attest.proof/abc123',
        cid: 'bafyreiabc123',
      });
    });
  });

  describe('parseAtUri', () => {
    it('should parse a valid AT URI', () => {
      const result = parseAtUri('at://did:plc:test123/me.attest.proof/abc123');
      expect(result).toEqual({
        repo: 'did:plc:test123',
        collection: 'me.attest.proof',
        rkey: 'abc123',
      });
    });

    it('should throw on invalid URI', () => {
      expect(() => parseAtUri('invalid://uri')).toThrow('Invalid AT URI');
    });
  });

  describe('extractRkey', () => {
    it('should extract rkey from URI', () => {
      const rkey = extractRkey('at://did:plc:test123/me.attest.proof/abc123');
      expect(rkey).toBe('abc123');
    });
  });
});
```

---

## Task 1.4: Create API Route Structure

### Location
Create files in `server/routes/`

### File 1.4.1: `server/routes/proofs.ts`

```typescript
import { Router, Request, Response } from 'express';
import { AtpAgent } from '@atproto/api';
import { getSessionFromRequest } from '../oauth';
import { listRecords, createRecord, getRecord, updateRecord } from '../lib/atproto-repo';
import { generateNonce, formatChallengeText, validateNonce } from '../lib/challenge';

const router = Router();

/**
 * GET /api/proofs/:did
 * List all proofs for a DID
 */
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { limit = '100', cursor } = req.query;

    // Create an unauthenticated agent for reading public data
    const agent = new AtpAgent({ service: 'https://bsky.social' });

    const result = await listRecords(
      agent,
      did,
      'me.attest.proof',
      parseInt(limit as string, 10),
      cursor as string | undefined
    );

    res.json({
      proofs: result.records.map((r) => ({
        uri: r.uri,
        cid: r.cid,
        ...r.value,
      })),
      cursor: result.cursor,
    });
  } catch (error: any) {
    console.error('Error listing proofs:', error);
    res.status(500).json({ error: 'Failed to list proofs', message: error.message });
  }
});

/**
 * POST /api/proofs/challenge
 * Generate a new challenge for proof creation
 */
router.post('/challenge', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { service, handle } = req.body;

    if (!service || !handle) {
      return res.status(400).json({ error: 'Missing required fields: service, handle' });
    }

    // Validate service is in known values
    const validServices = [
      'twitter', 'github', 'mastodon', 'hackernews', 'reddit',
      'lobsters', 'gitlab', 'linkedin', 'dns', 'https',
      'bitcoin', 'ethereum', 'solana', 'stellar',
    ];

    if (!validServices.includes(service)) {
      return res.status(400).json({ error: `Invalid service: ${service}` });
    }

    const nonce = generateNonce(128);
    const challengeText = formatChallengeText(
      session.did,
      service,
      handle,
      nonce
    );

    res.json({
      nonce,
      challengeText,
      did: session.did,
      service,
      handle,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    });
  } catch (error: any) {
    console.error('Error generating challenge:', error);
    res.status(500).json({ error: 'Failed to generate challenge', message: error.message });
  }
});

/**
 * POST /api/proofs/verify
 * Verify a proof URL and write to repo
 * Implementation will be completed in Phase 2
 */
router.post('/verify', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - will be added in Phase 2' });
});

/**
 * DELETE /api/proofs/:rkey
 * Revoke a proof
 */
router.delete('/:rkey', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rkey } = req.params;

    // Get the current proof
    const agent = new AtpAgent({ service: session.pdsUrl });
    agent.session = session;

    const uri = `at://${session.did}/me.attest.proof/${rkey}`;
    const current = await getRecord(agent, session.did, 'me.attest.proof', rkey);

    // Update status to revoked
    const updated = {
      ...current.value,
      status: 'revoked',
    };

    await updateRecord({ agent, did: session.did }, uri, updated);

    res.json({ success: true, message: 'Proof revoked' });
  } catch (error: any) {
    console.error('Error revoking proof:', error);
    res.status(500).json({ error: 'Failed to revoke proof', message: error.message });
  }
});

export default router;
```

### File 1.4.2: `server/routes/keys.ts`

```typescript
import { Router, Request, Response } from 'express';
import { AtpAgent } from '@atproto/api';
import { getSessionFromRequest } from '../oauth';
import { listRecords, createRecord, updateRecord } from '../lib/atproto-repo';

const router = Router();

/**
 * GET /api/keys/:did
 * List all public keys for a DID
 */
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { limit = '100', cursor } = req.query;

    const agent = new AtpAgent({ service: 'https://bsky.social' });

    const result = await listRecords(
      agent,
      did,
      'me.attest.key',
      parseInt(limit as string, 10),
      cursor as string | undefined
    );

    res.json({
      keys: result.records.map((r) => ({
        uri: r.uri,
        cid: r.cid,
        ...r.value,
      })),
      cursor: result.cursor,
    });
  } catch (error: any) {
    console.error('Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list keys', message: error.message });
  }
});

/**
 * POST /api/keys
 * Publish a new public key
 * Full implementation in Phase 3
 */
router.post('/', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - will be added in Phase 3' });
});

/**
 * DELETE /api/keys/:rkey
 * Revoke a key
 */
router.delete('/:rkey', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rkey } = req.params;

    const agent = new AtpAgent({ service: session.pdsUrl });
    agent.session = session;

    const uri = `at://${session.did}/me.attest.key/${rkey}`;
    const current = await getRecord(agent, session.did, 'me.attest.key', rkey);

    const updated = {
      ...current.value,
      status: 'revoked',
    };

    await updateRecord({ agent, did: session.did }, uri, updated);

    res.json({ success: true, message: 'Key revoked' });
  } catch (error: any) {
    console.error('Error revoking key:', error);
    res.status(500).json({ error: 'Failed to revoke key', message: error.message });
  }
});

export default router;
```

### File 1.4.3: `server/routes/index.ts`

```typescript
import { Router } from 'express';
import proofsRouter from './proofs';
import keysRouter from './keys';

const router = Router();

router.use('/proofs', proofsRouter);
router.use('/keys', keysRouter);

export default router;
```

### File 1.4.4: Update `server/index.ts`

Add the following to the existing server setup:

```typescript
import apiRoutes from './routes';

// ... existing code ...

// Add API routes
app.use('/api', apiRoutes);
```

---

## Task 1.5: Add TypeScript Types

### Location
Create file: `types/attestation.ts`

```typescript
/**
 * Type definitions for AttestFor.me records
 */

export interface ProofRecord {
  service: string;
  handle: string;
  proofUrl: string;
  nonce: string;
  challengeText: string;
  signature?: string;
  status: 'valid' | 'revoked';
  createdAt: string;
  verifiedAt?: string;
}

export interface KeyRecord {
  keyType: string;
  fingerprint?: string;
  publicKey: string;
  label?: string;
  comment?: string;
  expiresAt?: string;
  status: 'active' | 'revoked';
  createdAt: string;
}

export interface ProfileRecord {
  displayName?: string;
  bio?: string;
  website?: string;
  preferredKeyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StatementRecord {
  content: string;
  subject?: string;
  tags?: string[];
  ref?: string;
  status: 'active' | 'retracted';
  createdAt: string;
  retractedAt?: string;
}

export interface FollowRecord {
  subject: string; // DID
  verifiedProofs?: string[];
  verifiedKeys?: string[];
  comment?: string;
  verifiedAt: string;
  status: 'active' | 'revoked';
  createdAt: string;
  revokedAt?: string;
}

export interface ChallengeResponse {
  nonce: string;
  challengeText: string;
  did: string;
  service: string;
  handle: string;
  expiresAt: string;
}
```

---

## Task 1.6: Testing & Validation

### Manual Testing Checklist

1. **Lexicon Validation:**
   - [ ] All JSON files are valid JSON
   - [ ] All required fields are present in each lexicon
   - [ ] `maxGraphemes` and `maxLength` values are reasonable
   - [ ] `knownValues` and `enum` arrays contain unique values

2. **Challenge Generation:**
   - [ ] Run `npm test` for challenge.test.ts
   - [ ] Verify nonces are unique (run generation 10,000 times)
   - [ ] Verify challenge text format matches spec exactly
   - [ ] Verify nonce validation rejects invalid nonces

3. **AT Proto Repo Library:**
   - [ ] Run `npm test` for atproto-repo.test.ts
   - [ ] Test with real AT Proto PDS (if available)
   - [ ] Verify URI parsing handles edge cases

4. **API Routes:**
   - [ ] Start the dev server
   - [ ] Test `GET /api/proofs/:did` with a valid DID
   - [ ] Test `POST /api/proofs/challenge` (requires auth)
   - [ ] Verify challenge response format
   - [ ] Test with invalid service names (should return 400)
   - [ ] Test without authentication (should return 401)

5. **Integration:**
   - [ ] Verify OAuth session retrieval works
   - [ ] Test complete flow: authenticate → generate challenge → verify response format
   - [ ] Check error handling for network failures

### Automated Tests

Create file: `server/routes/proofs.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import proofsRouter from './proofs';

describe('Proofs API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/proofs', proofsRouter);
  });

  describe('POST /api/proofs/challenge', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/proofs/challenge')
        .send({ service: 'twitter', handle: '@alice' });

      expect(response.status).toBe(401);
    });

    it('should return 400 with missing fields', async () => {
      // Mock authentication
      vi.mock('../oauth', () => ({
        getSessionFromRequest: () => ({ did: 'did:plc:test123', pdsUrl: 'https://bsky.social' }),
      }));

      const response = await request(app)
        .post('/api/proofs/challenge')
        .send({ service: 'twitter' }); // missing handle

      expect(response.status).toBe(400);
    });

    it('should return 400 with invalid service', async () => {
      vi.mock('../oauth', () => ({
        getSessionFromRequest: () => ({ did: 'did:plc:test123', pdsUrl: 'https://bsky.social' }),
      }));

      const response = await request(app)
        .post('/api/proofs/challenge')
        .send({ service: 'invalid_service', handle: '@alice' });

      expect(response.status).toBe(400);
    });
  });
});
```

---

## Task 1.7: Documentation

Create file: `docs/api/phase-1-endpoints.md`

```markdown
# Phase 1 API Endpoints

## Authentication

All endpoints that modify data require OAuth authentication. Include the session cookie or bearer token.

## Endpoints

### GET /api/proofs/:did

List all proofs for a given DID.

**Parameters:**
- `did` (path): The DID to query
- `limit` (query, optional): Max records to return (default: 100)
- `cursor` (query, optional): Pagination cursor

**Response:**
```json
{
  "proofs": [
    {
      "uri": "at://did:plc:abc123/me.attest.proof/xyz789",
      "cid": "bafyrei...",
      "service": "twitter",
      "handle": "@alice",
      "proofUrl": "https://twitter.com/alice/status/123",
      "nonce": "R4nD0m...",
      "challengeText": "I am did:plc:abc123...",
      "status": "valid",
      "createdAt": "2026-02-13T12:00:00Z"
    }
  ],
  "cursor": "..."
}
```

### POST /api/proofs/challenge

Generate a new proof challenge.

**Authentication:** Required

**Body:**
```json
{
  "service": "twitter",
  "handle": "@alice"
}
```

**Response:**
```json
{
  "nonce": "R4nD0mN0nc3...",
  "challengeText": "I am did:plc:abc123 on AT Protocol.\nVerifying my twitter account @alice for attest.me.\nNonce: R4nD0mN0nc3...",
  "did": "did:plc:abc123",
  "service": "twitter",
  "handle": "@alice",
  "expiresAt": "2026-02-13T12:30:00Z"
}
```

### DELETE /api/proofs/:rkey

Revoke a proof.

**Authentication:** Required

**Parameters:**
- `rkey` (path): The record key of the proof to revoke

**Response:**
```json
{
  "success": true,
  "message": "Proof revoked"
}
```

### GET /api/keys/:did

List all public keys for a given DID.

**Parameters:**
- `did` (path): The DID to query
- `limit` (query, optional): Max records to return (default: 100)
- `cursor` (query, optional): Pagination cursor

**Response:**
```json
{
  "keys": [
    {
      "uri": "at://did:plc:abc123/me.attest.key/xyz789",
      "cid": "bafyrei...",
      "keyType": "ssh-ed25519",
      "fingerprint": "SHA256:abc123...",
      "publicKey": "ssh-ed25519 AAAAC3...",
      "label": "work laptop",
      "status": "active",
      "createdAt": "2026-02-13T12:00:00Z"
    }
  ],
  "cursor": "..."
}
```

### DELETE /api/keys/:rkey

Revoke a key.

**Authentication:** Required

**Parameters:**
- `rkey` (path): The record key of the key to revoke

**Response:**
```json
{
  "success": true,
  "message": "Key revoked"
}
```
```

---

## Acceptance Criteria

Phase 1 is complete when:

- [ ] All 5 lexicon JSON files are created and valid
- [ ] Challenge generation library is implemented with tests passing
- [ ] AT Proto repo interaction library is implemented with tests passing
- [ ] API routes for proofs and keys are created
- [ ] `GET /api/proofs/:did` works and returns data
- [ ] `POST /api/proofs/challenge` generates valid challenges
- [ ] `DELETE /api/proofs/:rkey` revokes proofs
- [ ] `GET /api/keys/:did` works and returns data
- [ ] `DELETE /api/keys/:rkey` revokes keys
- [ ] All TypeScript types are defined
- [ ] Unit tests achieve >80% code coverage
- [ ] API documentation is complete
- [ ] Manual testing checklist is completed

---

## Next Phase

Proceed to **Phase 2: Core Proof Verification + Wallet Proofs** after all acceptance criteria are met.
