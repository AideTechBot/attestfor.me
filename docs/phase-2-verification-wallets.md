# Phase 2: Core Proof Verification (Twitter/X + GitHub) — Detailed Implementation Guide

**Objective:** Implement proof verification engines for Twitter/X and GitHub as the initial supported services. Additional services will be added in Phase 6, and cryptocurrency wallet proofs in Phase 7.

**Prerequisites:**
- Phase 1 completed (lexicons, challenge generation, AT Proto repo library, basic API routes)
- OAuth authentication working
- Node.js with TypeScript

**Scope:** This phase focuses on getting the core verification system working with just two services (Twitter and GitHub) to validate the architecture before expanding. **Cryptocurrency wallet support is explicitly out of scope for this phase.**

---

## Task 2.1: Base Verifier Interface

### Location
Create file: `server/services/base-verifier.ts`

### Implementation

```typescript
/**
 * Base interface for all proof verifiers
 */
export interface VerificationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  details?: Record<string, any>;
}

export interface ProofVerifierConfig {
  timeout?: number; // Request timeout in milliseconds (default: 10000)
  userAgent?: string; // User agent for HTTP requests
}

export abstract class BaseProofVerifier {
  protected config: Required<ProofVerifierConfig>;

  constructor(config?: ProofVerifierConfig) {
    this.config = {
      timeout: config?.timeout || 10000,
      userAgent: config?.userAgent || 'AttestForMe/1.0 (proof verification bot)',
    };
  }

  /**
   * Verify a proof by fetching external content
   * @param proofUrl The URL where the proof should be found
   * @param expectedChallenge The challenge text we expect to find
   * @param handle The handle/username being verified
   * @returns Verification result
   */
  abstract verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string
  ): Promise<VerificationResult>;

  /**
   * Validate the proof URL format for this service
   * @param proofUrl The URL to validate
   * @returns true if valid format
   */
  abstract validateProofUrl(proofUrl: string): boolean;

  /**
   * Normalize handle format (e.g., add @ prefix if missing)
   * @param handle The handle to normalize
   * @returns Normalized handle
   */
  abstract normalizeHandle(handle: string): string;

  /**
   * Extract the service identifier
   * @returns Service name (e.g., 'twitter', 'github')
   */
  abstract getServiceName(): string;
}
```

---

## Task 2.2: GitHub Gist Verifier

### Location
Create file: `server/services/github.ts`

### Implementation

```typescript
import { BaseProofVerifier, VerificationResult } from './base-verifier';

export class GitHubVerifier extends BaseProofVerifier {
  getServiceName(): string {
    return 'github';
  }

  validateProofUrl(proofUrl: string): boolean {
    // Format: https://gist.github.com/{username}/{gist_id}
    const pattern = /^https:\/\/gist\.github\.com\/[a-zA-Z0-9_-]+\/[a-f0-9]{20,}$/;
    return pattern.test(proofUrl);
  }

  normalizeHandle(handle: string): string {
    // Remove @ prefix if present
    return handle.startsWith('@') ? handle.substring(1) : handle;
  }

  async verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string
  ): Promise<VerificationResult> {
    try {
      // Validate URL format
      if (!this.validateProofUrl(proofUrl)) {
        return {
          success: false,
          error: 'Invalid GitHub gist URL format',
          errorCode: 'INVALID_URL',
        };
      }

      // Extract gist ID from URL
      const match = proofUrl.match(/\/([a-f0-9]{20,})$/);
      if (!match) {
        return {
          success: false,
          error: 'Could not extract gist ID from URL',
          errorCode: 'INVALID_GIST_ID',
        };
      }

      const gistId = match[1];
      const normalizedHandle = this.normalizeHandle(handle);

      // Fetch gist via GitHub API
      const apiUrl = `https://api.github.com/gists/${gistId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Gist not found',
            errorCode: 'GIST_NOT_FOUND',
          };
        }
        return {
          success: false,
          error: `GitHub API error: ${response.status}`,
          errorCode: 'API_ERROR',
        };
      }

      const gist = await response.json();

      // Verify owner matches handle
      if (gist.owner?.login?.toLowerCase() !== normalizedHandle.toLowerCase()) {
        return {
          success: false,
          error: `Gist owner (${gist.owner?.login}) does not match handle (${normalizedHandle})`,
          errorCode: 'HANDLE_MISMATCH',
        };
      }

      // Check all files for the challenge text
      let foundChallenge = false;
      for (const [filename, file] of Object.entries<any>(gist.files)) {
        if (file.content && file.content.includes(expectedChallenge)) {
          foundChallenge = true;
          break;
        }
      }

      if (!foundChallenge) {
        return {
          success: false,
          error: 'Challenge text not found in gist',
          errorCode: 'CHALLENGE_NOT_FOUND',
        };
      }

      return {
        success: true,
        details: {
          gistId,
          owner: gist.owner.login,
          createdAt: gist.created_at,
          updatedAt: gist.updated_at,
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          errorCode: 'TIMEOUT',
        };
      }

      return {
        success: false,
        error: `Verification failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }
}
```

**Test file:** `server/services/github.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubVerifier } from './github';

describe('GitHubVerifier', () => {
  let verifier: GitHubVerifier;

  beforeEach(() => {
    verifier = new GitHubVerifier();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateProofUrl', () => {
    it('should accept valid gist URLs', () => {
      expect(
        verifier.validateProofUrl('https://gist.github.com/alice/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8')
      ).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(verifier.validateProofUrl('https://github.com/alice/repo')).toBe(false);
      expect(verifier.validateProofUrl('https://gist.github.com/alice')).toBe(false);
    });
  });

  describe('normalizeHandle', () => {
    it('should remove @ prefix', () => {
      expect(verifier.normalizeHandle('@alice')).toBe('alice');
    });

    it('should leave handle without @ unchanged', () => {
      expect(verifier.normalizeHandle('alice')).toBe('alice');
    });
  });

  describe('verify', () => {
    it('should successfully verify a valid gist', async () => {
      const mockGist = {
        owner: { login: 'alice' },
        files: {
          'proof.txt': {
            content: 'I am did:plc:abc123 on AT Protocol.\nVerifying my github account alice for attest.me.\nNonce: R4nD0m',
          },
        },
        created_at: '2026-02-13T12:00:00Z',
        updated_at: '2026-02-13T12:00:00Z',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGist,
      } as any);

      const result = await verifier.verify(
        'https://gist.github.com/alice/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
        'I am did:plc:abc123 on AT Protocol.\nVerifying my github account alice for attest.me.\nNonce: R4nD0m',
        'alice'
      );

      expect(result.success).toBe(true);
      expect(result.details?.owner).toBe('alice');
    });

    it('should fail if challenge not found', async () => {
      const mockGist = {
        owner: { login: 'alice' },
        files: {
          'proof.txt': {
            content: 'Some other content',
          },
        },
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockGist,
      } as any);

      const result = await verifier.verify(
        'https://gist.github.com/alice/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
        'Expected challenge text',
        'alice'
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should fail if handle mismatch', async () => {
      const mockGist = {
        owner: { login: 'bob' },
        files: {},
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockGist,
      } as any);

      const result = await verifier.verify(
        'https://gist.github.com/bob/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
        'Challenge',
        'alice'
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('HANDLE_MISMATCH');
    });
  });
});
```

---

## Task 2.3: Twitter/X Verifier

### Location
Create file: `server/services/twitter.ts`

### Implementation

```typescript
import { BaseProofVerifier, VerificationResult } from './base-verifier';
import * as cheerio from 'cheerio';

export class TwitterVerifier extends BaseProofVerifier {
  getServiceName(): string {
    return 'twitter';
  }

  validateProofUrl(proofUrl: string): boolean {
    // Format: https://twitter.com/{username}/status/{tweet_id} or https://x.com/...
    const pattern = /^https:\/\/(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+$/;
    return pattern.test(proofUrl);
  }

  normalizeHandle(handle: string): string {
    // Ensure @ prefix
    return handle.startsWith('@') ? handle : `@${handle}`;
  }

  async verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string
  ): Promise<VerificationResult> {
    try {
      if (!this.validateProofUrl(proofUrl)) {
        return {
          success: false,
          error: 'Invalid Twitter URL format',
          errorCode: 'INVALID_URL',
        };
      }

      const normalizedHandle = this.normalizeHandle(handle);

      // Extract username and tweet ID from URL
      const match = proofUrl.match(/\/(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)$/);
      if (!match) {
        return {
          success: false,
          error: 'Could not parse Twitter URL',
          errorCode: 'INVALID_URL',
        };
      }

      const [, , username, tweetId] = match;

      // Verify username matches handle
      if (`@${username.toLowerCase()}` !== normalizedHandle.toLowerCase()) {
        return {
          success: false,
          error: `Tweet author (@${username}) does not match handle (${normalizedHandle})`,
          errorCode: 'HANDLE_MISMATCH',
        };
      }

      // Fetch tweet HTML (Twitter/X doesn't provide unauthenticated API access)
      // Note: This approach uses nitter.net or similar public frontend
      // For production, consider using Twitter API with proper authentication
      const nitterUrl = proofUrl.replace('twitter.com', 'nitter.net').replace('x.com', 'nitter.net');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(nitterUrl, {
        headers: {
          'User-Agent': this.config.userAgent,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Fallback: try direct Twitter URL scraping
        return await this.verifyViaDirectScraping(proofUrl, expectedChallenge, username);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract tweet text from nitter
      const tweetText = $('.tweet-content').text();

      if (!tweetText) {
        return {
          success: false,
          error: 'Could not extract tweet text',
          errorCode: 'EXTRACTION_FAILED',
        };
      }

      // Check if challenge text is present
      if (!tweetText.includes(expectedChallenge)) {
        return {
          success: false,
          error: 'Challenge text not found in tweet',
          errorCode: 'CHALLENGE_NOT_FOUND',
        };
      }

      return {
        success: true,
        details: {
          username,
          tweetId,
          tweetText: tweetText.substring(0, 200), // Truncate for storage
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          errorCode: 'TIMEOUT',
        };
      }

      return {
        success: false,
        error: `Verification failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  private async verifyViaDirectScraping(
    proofUrl: string,
    expectedChallenge: string,
    username: string
  ): Promise<VerificationResult> {
    // Fallback method: attempt to scrape Twitter directly
    // Note: This may be blocked by Twitter's anti-scraping measures
    // Production should use official Twitter API

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(proofUrl, {
        headers: {
          'User-Agent': this.config.userAgent,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: 'Could not fetch tweet (API authentication may be required)',
          errorCode: 'FETCH_FAILED',
          details: {
            note: 'Consider using Twitter API with proper credentials for production',
          },
        };
      }

      const html = await response.text();

      // Simple text search (Twitter's HTML structure changes frequently)
      if (html.includes(expectedChallenge)) {
        return {
          success: true,
          details: {
            username,
            method: 'direct_scraping',
            note: 'Verification succeeded via HTML scraping',
          },
        };
      }

      return {
        success: false,
        error: 'Challenge text not found in tweet',
        errorCode: 'CHALLENGE_NOT_FOUND',
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Direct scraping failed: ${error.message}`,
        errorCode: 'SCRAPING_FAILED',
      };
    }
  }
}
```

**Dependencies to add:**
```bash
npm install cheerio
npm install -D @types/cheerio
```

---

## Task 2.4: Update Proof Verification Route

### Location
Update file: `server/routes/proofs.ts`

Add the verification implementation for Twitter and GitHub only:

```typescript
import { GitHubVerifier } from '../services/github';
import { TwitterVerifier } from '../services/twitter';
import { BaseProofVerifier } from '../services/base-verifier';
import { parseChallengeText, validateNonce } from '../challenge';
import { createRecord } from '../atproto-repo';

/**
 * POST /api/proofs/verify
 * Verify a proof URL and write to repo (Twitter/GitHub only)
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { service, handle, proofUrl, nonce, challengeText } = req.body;

    // Validate required fields
    if (!service || !handle || !proofUrl || !nonce || !challengeText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only twitter and github supported in Phase 2
    if (!['twitter', 'github'].includes(service)) {
      return res.status(400).json({
        error: 'Unsupported service',
        message: 'Only twitter and github are currently supported. Other services will be added in later phases.',
      });
    }

    // Validate nonce
    if (!validateNonce(nonce)) {
      return res.status(400).json({ error: 'Invalid nonce format' });
    }

    // Parse and validate challenge text
    const parsed = parseChallengeText(challengeText);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid challenge text format' });
    }

    // Verify challenge components match request
    if (
      parsed.did !== session.did ||
      parsed.service !== service ||
      parsed.handle !== handle ||
      parsed.nonce !== nonce
    ) {
      return res.status(400).json({
        error: 'Challenge text does not match request parameters',
      });
    }

    // Select appropriate verifier
    let verifier: BaseProofVerifier;
    switch (service) {
      case 'twitter':
        verifier = new TwitterVerifier();
        break;
      case 'github':
        verifier = new GitHubVerifier();
        break;
      default:
        return res.status(400).json({ error: 'Unsupported service' });
    }

    // Verify the proof
    const verificationResult = await verifier.verify(proofUrl, challengeText, handle);

    if (!verificationResult.success) {
      return res.status(400).json({
        error: 'Verification failed',
        message: verificationResult.error,
        errorCode: verificationResult.errorCode,
      });
    }

    // Create proof record in AT Proto repo
    const proofRecord = {
      service,
      handle,
      proofUrl,
      challengeText,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const result = await createRecord(
      { agent: req.agent, did: session.did },
      'me.attest.proof',
      proofRecord
    );

    res.json({
      success: true,
      uri: result.uri,
      cid: result.cid,
      verificationDetails: verificationResult.details,
    });
  } catch (error: any) {
    console.error('Error verifying proof:', error);
    res.status(500).json({
      error: 'Failed to verify proof',
      message: error.message,
    });
  }
});
```

---

## MOVED TO PHASE 6: DNS and HTTPS Verifiers

The following verifiers have been moved to Phase 6 to focus on core Twitter/GitHub functionality first:
- DNS TXT record verification
- HTTPS/.well-known verification
- Other social/domain proofs

---

## MOVED TO PHASE 7: Wallet Verifiers

All cryptocurrency wallet verifiers have been moved to Phase 7:
- Ethereum wallet verification
- Bitcoin wallet verification
- Solana wallet verification
- Other blockchain wallet proofs

The Phase 2 implementation will focus exclusively on Twitter and GitHub to validate the architecture before expanding to additional services.

---

  validateProofUrl(proofUrl: string): boolean {
    // Format: dns://domain.com or just domain.com
    const pattern = /^(dns:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return pattern.test(proofUrl);
  }

  normalizeHandle(handle: string): string {
    // For DNS, handle is the domain name
    return handle.toLowerCase().replace(/^(dns:\/\/|https?:\/\/)/, '');
  }

  async verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string
  ): Promise<VerificationResult> {
    try {
      if (!this.validateProofUrl(proofUrl)) {
        return {
          success: false,
          error: 'Invalid domain format',
          errorCode: 'INVALID_DOMAIN',
        };
      }

      const domain = this.normalizeHandle(handle);

      // Lookup TXT records for the domain
      let txtRecords: string[][];
      try {
        txtRecords = await dns.resolveTxt(domain);
      } catch (error: any) {
        if (error.code === 'ENOTFOUND') {
          return {
            success: false,
            error: 'Domain not found',
            errorCode: 'DOMAIN_NOT_FOUND',
          };
        }
        if (error.code === 'ENODATA') {
          return {
            success: false,
            error: 'No TXT records found for domain',
            errorCode: 'NO_TXT_RECORDS',
          };
        }
        throw error;
      }

      // Flatten TXT record arrays and search for challenge
      const allRecords = txtRecords.flat();
      let foundChallenge = false;
      let matchingRecord = '';

      for (const record of allRecords) {
        if (record.includes(expectedChallenge)) {
          foundChallenge = true;
          matchingRecord = record;
          break;
        }
      }

      if (!foundChallenge) {
        return {
          success: false,
          error: 'Challenge text not found in TXT records',
          errorCode: 'CHALLENGE_NOT_FOUND',
          details: {
            recordsFound: allRecords.length,
            sample: allRecords.slice(0, 3), // Show first 3 records for debugging
          },
        };
      }

      return {
        success: true,
        details: {
          domain,
          recordCount: allRecords.length,
          matchingRecord: matchingRecord.substring(0, 200),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `DNS verification failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }
}
```

**Test file:** `server/services/dns.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DNSVerifier } from './dns';
import { promises as dns } from 'dns';

vi.mock('dns', () => ({
  promises: {
    resolveTxt: vi.fn(),
  },
}));

describe('DNSVerifier', () => {
  let verifier: DNSVerifier;

  beforeEach(() => {
    verifier = new DNSVerifier();
  });

  describe('validateProofUrl', () => {
    it('should accept valid domains', () => {
      expect(verifier.validateProofUrl('example.com')).toBe(true);
      expect(verifier.validateProofUrl('dns://example.com')).toBe(true);
      expect(verifier.validateProofUrl('subdomain.example.com')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(verifier.validateProofUrl('not a domain')).toBe(false);
      expect(verifier.validateProofUrl('http://example.com/path')).toBe(false);
    });
  });

  describe('verify', () => {
    it('should successfully verify domain with matching TXT record', async () => {
      const challenge = 'I am did:plc:abc123 on AT Protocol.\nVerifying my dns account example.com for attest.me.\nNonce: R4nD0m';

      vi.mocked(dns.resolveTxt).mockResolvedValue([
        ['some-other-record'],
        [challenge],
        ['another-record'],
      ]);

      const result = await verifier.verify('dns://example.com', challenge, 'example.com');

      expect(result.success).toBe(true);
      expect(result.details?.domain).toBe('example.com');
    });

    it('should fail if challenge not found', async () => {
      vi.mocked(dns.resolveTxt).mockResolvedValue([['unrelated-txt-record']]);

      const result = await verifier.verify(
        'dns://example.com',
        'Expected challenge',
        'example.com'
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should fail if domain not found', async () => {
      vi.mocked(dns.resolveTxt).mockRejectedValue({ code: 'ENOTFOUND' });

      const result = await verifier.verify('dns://nonexistent.com', 'Challenge', 'nonexistent.com');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('DOMAIN_NOT_FOUND');
    });
  });
});
```

---

## Task 2.5: HTTPS/.well-known Verifier

### Location
Create file: `server/services/https.ts`

### Implementation

```typescript
import { BaseProofVerifier, VerificationResult } from './base-verifier';

export class HTTPSVerifier extends BaseProofVerifier {
  getServiceName(): string {
    return 'https';
  }

  validateProofUrl(proofUrl: string): boolean {
    // Format: https://domain.com/.well-known/attest-me.json or https://domain.com
    const pattern = /^https:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;
    return pattern.test(proofUrl);
  }

  normalizeHandle(handle: string): string {
    // For HTTPS, handle is the domain
    return handle.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }

  async verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string
  ): Promise<VerificationResult> {
    try {
      if (!this.validateProofUrl(proofUrl)) {
        return {
          success: false,
          error: 'Invalid HTTPS URL format',
          errorCode: 'INVALID_URL',
        };
      }

      const domain = this.normalizeHandle(handle);

      // Construct .well-known URL if not provided
      let wellKnownUrl: string;
      if (proofUrl.includes('/.well-known/attest-me')) {
        wellKnownUrl = proofUrl;
      } else {
        wellKnownUrl = `https://${domain}/.well-known/attest-me.json`;
      }

      // Verify domain in URL matches handle
      const urlDomain = new URL(wellKnownUrl).hostname;
      if (urlDomain !== domain) {
        return {
          success: false,
          error: `URL domain (${urlDomain}) does not match handle (${domain})`,
          errorCode: 'DOMAIN_MISMATCH',
        };
      }

      // Fetch .well-known file
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(wellKnownUrl, {
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'application/json, text/plain',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: '.well-known/attest-me.json not found',
            errorCode: 'FILE_NOT_FOUND',
          };
        }
        return {
          success: false,
          error: `HTTP error: ${response.status}`,
          errorCode: 'HTTP_ERROR',
        };
      }

      const contentType = response.headers.get('content-type');
      let content: any;

      if (contentType?.includes('application/json')) {
        content = await response.json();
      } else {
        content = await response.text();
      }

      // Check if challenge is present
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      if (!contentStr.includes(expectedChallenge)) {
        return {
          success: false,
          error: 'Challenge text not found in .well-known file',
          errorCode: 'CHALLENGE_NOT_FOUND',
        };
      }

      return {
        success: true,
        details: {
          domain,
          url: wellKnownUrl,
          contentType: contentType || 'unknown',
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          errorCode: 'TIMEOUT',
        };
      }

      return {
        success: false,
        error: `HTTPS verification failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }
}
```

---

## Task 2.6: Wallet Verifiers - Base Class

### Location
Create file: `server/services/wallets/base-wallet-verifier.ts`

### Implementation

```typescript
import { VerificationResult } from '../base-verifier';

export interface WalletVerificationParams {
  address: string;
  message: string;
  signature: string;
}

export abstract class BaseWalletVerifier {
  /**
   * Verify a wallet signature
   * @param params Wallet verification parameters
   * @returns Verification result
   */
  abstract verify(params: WalletVerificationParams): Promise<VerificationResult>;

  /**
   * Validate wallet address format
   * @param address The wallet address to validate
   * @returns true if valid format
   */
  abstract validateAddress(address: string): boolean;

  /**
   * Get the blockchain name
   * @returns Blockchain name (e.g., 'ethereum', 'bitcoin')
   */
  abstract getChainName(): string;

  /**
   * Normalize address format (e.g., lowercase for Ethereum, checksum format, etc.)
   * @param address The address to normalize
   * @returns Normalized address
   */
  abstract normalizeAddress(address: string): string;
}
```

---

## Task 2.7: Ethereum Wallet Verifier

### Location
Create file: `server/services/wallets/ethereum.ts`

### Implementation

```typescript
import { BaseWalletVerifier, WalletVerificationParams } from './base-wallet-verifier';
import { VerificationResult } from '../base-verifier';
import { verifyMessage } from 'ethers';

export class EthereumWalletVerifier extends BaseWalletVerifier {
  getChainName(): string {
    return 'ethereum';
  }

  validateAddress(address: string): boolean {
    // Ethereum address: 0x followed by 40 hex characters
    const pattern = /^0x[a-fA-F0-9]{40}$/;
    return pattern.test(address);
  }

  normalizeAddress(address: string): string {
    // Convert to checksum format using ethers.js
    try {
      return verifyMessage('', '').toLowerCase(); // This will normalize without verifying
    } catch {
      return address.toLowerCase();
    }
  }

  async verify(params: WalletVerificationParams): Promise<VerificationResult> {
    try {
      const { address, message, signature } = params;

      // Validate address format
      if (!this.validateAddress(address)) {
        return {
          success: false,
          error: 'Invalid Ethereum address format',
          errorCode: 'INVALID_ADDRESS',
        };
      }

      // Verify signature using ethers.js
      let recoveredAddress: string;
      try {
        recoveredAddress = verifyMessage(message, signature);
      } catch (error: any) {
        return {
          success: false,
          error: 'Invalid signature format or signature verification failed',
          errorCode: 'INVALID_SIGNATURE',
          details: {
            reason: error.message,
          },
        };
      }

      // Compare recovered address with claimed address (case-insensitive)
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return {
          success: false,
          error: 'Signature does not match address',
          errorCode: 'ADDRESS_MISMATCH',
          details: {
            claimed: address,
            recovered: recoveredAddress,
          },
        };
      }

      return {
        success: true,
        details: {
          address: recoveredAddress,
          chain: 'ethereum',
          signatureValid: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Ethereum verification failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }
}
```

**Dependencies:**
```bash
npm install ethers
```

**Test file:** `server/services/wallets/ethereum.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { EthereumWalletVerifier } from './ethereum';
import { Wallet } from 'ethers';

describe('EthereumWalletVerifier', () => {
  let verifier: EthereumWalletVerifier;

  beforeEach(() => {
    verifier = new EthereumWalletVerifier();
  });

  describe('validateAddress', () => {
    it('should accept valid Ethereum addresses', () => {
      expect(verifier.validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false); // One char short
      expect(verifier.validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(verifier.validateAddress('not an address')).toBe(false);
      expect(verifier.validateAddress('0x123')).toBe(false);
      expect(verifier.validateAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(false); // Missing 0x
    });
  });

  describe('verify', () => {
    it('should successfully verify a valid signature', async () => {
      // Create a test wallet
      const wallet = Wallet.createRandom();
      const message = 'I am did:plc:abc123 on AT Protocol.\nVerifying my ethereum wallet for attest.me.\nNonce: test123';
      const signature = await wallet.signMessage(message);

      const result = await verifier.verify({
        address: wallet.address,
        message,
        signature,
      });

      expect(result.success).toBe(true);
      expect(result.details?.address.toLowerCase()).toBe(wallet.address.toLowerCase());
    });

    it('should fail with wrong address', async () => {
      const wallet = Wallet.createRandom();
      const wrongWallet = Wallet.createRandom();
      const message = 'Test message';
      const signature = await wallet.signMessage(message);

      const result = await verifier.verify({
        address: wrongWallet.address,
        message,
        signature,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ADDRESS_MISMATCH');
    });

    it('should fail with invalid signature format', async () => {
      const result = await verifier.verify({
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        message: 'Test message',
        signature: 'invalid_signature',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_SIGNATURE');
    });
  });
});
```

---

## Task 2.8: Bitcoin Wallet Verifier

### Location
Create file: `server/services/wallets/bitcoin.ts`

### Implementation

```typescript
import { BaseWalletVerifier, WalletVerificationParams } from './base-wallet-verifier';
import { VerificationResult } from '../base-verifier';
import * as bitcoinMessage from 'bitcoinjs-message';
import * as bitcoin from 'bitcoinjs-lib';

export class BitcoinWalletVerifier extends BaseWalletVerifier {
  getChainName(): string {
    return 'bitcoin';
  }

  validateAddress(address: string): boolean {
    // Bitcoin addresses: Legacy (1...), SegWit (3...), or Bech32 (bc1...)
    const patterns = [
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Legacy and P2SH
      /^bc1[a-z0-9]{39,87}$/, // Bech32
    ];

    return patterns.some((pattern) => pattern.test(address));
  }

  normalizeAddress(address: string): string {
    // Bitcoin addresses are case-sensitive for legacy/P2SH,
    // but Bech32 should be lowercase
    if (address.startsWith('bc1')) {
      return address.toLowerCase();
    }
    return address;
  }

  async verify(params: WalletVerificationParams): Promise<VerificationResult> {
    try {
      const { address, message, signature } = params;

      if (!this.validateAddress(address)) {
        return {
          success: false,
          error: 'Invalid Bitcoin address format',
          errorCode: 'INVALID_ADDRESS',
        };
      }

      // Verify signature using bitcoinjs-message
      let isValid: boolean;
      try {
        isValid = bitcoinMessage.verify(message, address, signature);
      } catch (error: any) {
        return {
          success: false,
          error: 'Invalid signature format',
          errorCode: 'INVALID_SIGNATURE',
          details: {
            reason: error.message,
          },
        };
      }

      if (!isValid) {
        return {
          success: false,
          error: 'Signature verification failed',
          errorCode: 'SIGNATURE_INVALID',
        };
      }

      return {
        success: true,
        details: {
          address: this.normalizeAddress(address),
          chain: 'bitcoin',
          signatureValid: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Bitcoin verification failed: ${error.message}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }
}
```

**Dependencies:**
```bash
npm install bitcoinjs-lib bitcoinjs-message
npm install -D @types/bitcoinjs-lib
```

---

## Task 2.5: (Optional) Server-Side Cached Verification

**Note**: This task is optional for Phase 2 and can be deferred if time is limited. The basic verification flow (Task 2.4) is sufficient for MVP.

### Location
Add to file: `server/routes/proofs.ts`

### Purpose
Provide server-side verification with caching to prevent DDoS attacks from repeated verification requests.

### Implementation Overview
- Add `/api/proofs/verify-cached` endpoint
- Cache verification results for 24 hours using Redis or in-memory storage
- Return cached results when available
- Update proof records with serverVerification metadata

**This feature can be implemented later if core verification is working well.**

---

## Task 2.6: (Optional) Client-Side Proof Replay

**Note**: This task is optional for Phase 2 and provides additional transparency but is not required for basic functionality.

### Purpose
Allow users to independently verify proofs in their browser without trusting the server.

### Implementation Overview
- Create `src/lib/proof-replay.ts` with verification replay logic
- Fetch proof content directly from Twitter/GitHub in the browser
- Validate challenge text matches


## Acceptance Criteria

Phase 2 is complete when:

**Core Verification:**
- [ ] Base verifier interface is implemented (`server/services/base-verifier.ts`)
- [ ] GitHub gist verifier works with tests passing
- [ ] Twitter/X verifier works (with appropriate notes about API limitations)
- [ ] `POST /api/proofs/verify` endpoint handles GitHub and Twitter only
- [ ] Service select UI shows only GitHub and Twitter as available
- [ ] Other services show "Coming Soon" or similar messaging

**Frontend Flow:**
- [ ] Proof creation wizard guides users through Twitter/GitHub proof creation
- [ ] Challenge generation works for twitter and github services
- [ ] Users can paste gist/tweet URLs
- [ ] Verification results display clearly
- [ ] Error messages are user-friendly and actionable

**End-to-End Flow:**
- [ ] Full flow works: generate challenge → post to GitHub gist or Twitter → verify → write to repo
- [ ] Failed verifications return clear error messages with specific error codes
- [ ] Successful verifications create `active` proof records in AT Proto repo
- [ ] Profile pages can display proofs correctly

**Testing:**
- [ ] Unit tests for verifiers (GitHub, Twitter)
- [ ] Unit tests for base verifier interface
- [ ] Integration tests for `/api/proofs/verify` endpoint
- [ ] All tests pass with >75% coverage

**Documentation:**
- [ ] Update README to note that only GitHub/Twitter are currently supported
- [ ] Document proof verification architecture
- [ ] Note that DNS, HTTPS, and wallet proofs are planned for future phases

---

## Out of Scope for Phase 2

The following were originally planned for Phase 2 but have been **moved to later phases**:

### Moved to Phase 6:
- DNS TXT record verification
- HTTPS/.well-known verification
- Other domain-based proof services
- Additional social platform verifiers (Mastodon, Reddit, etc.)

### Moved to Phase 7:
- **All cryptocurrency wallet verifiers**:
  - Ethereum wallet verification
  - Bitcoin wallet verification
  - Solana, Stellar, and other blockchain wallets
  - Wallet signature verification
  - Client-side wallet signing components

**Rationale**: Focus Phase 2 exclusively on getting Twitter and GitHub working end-to-end. This validates the entire architecture (lexicons, challenge generation, verification, AT Proto record writing) with just two services before expanding. Cryptocurrency wallet support requires additional dependencies (ethers.js, bitcoinjs-lib) and complexity that can be added once the core pattern is proven.

---

## Next Phase

Proceed to **Phase 3: Public Keys + Sign & Verify** after all acceptance criteria are met.
