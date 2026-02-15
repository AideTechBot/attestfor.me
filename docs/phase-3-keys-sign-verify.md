# Phase 3: Public Keys + Sign & Verify — Detailed Implementation Guide

**Objective:** Implement public key upload, parsing, fingerprint extraction for PGP/SSH/age/minisign/signify/WireGuard, build the key fetch API (like GitHub's `/username.keys`), and create an in-browser sign & verify tool.

**Prerequisites:**
- Phase 1 completed (lexicons, challenge generation, AT Proto repo library)
- Phase 2 completed (proof verification, wallet proofs)

---

## Task 3.1: Key Parser Library

### Location
Create file: `server/lib/key-parser.ts`

### Implementation

```typescript
import * as openpgp from 'openpgp';
import { createHash } from 'crypto';

export interface ParsedKey {
  type: string;
  fingerprint: string;
  publicKey: string;
  comment?: string;
  expiresAt?: string;
  keyId?: string;
  algorithm?: string;
}

/**
 * Parse and extract fingerprint from a PGP public key
 */
export async function parsePGPKey(armoredKey: string): Promise<ParsedKey> {
  try {
    const key = await openpgp.readKey({ armoredKey });

    const fingerprint = key.getFingerprint().toUpperCase();
    const keyId = key.getKeyID().toHex().toUpperCase();
    const creationTime = key.getCreationTime();
    
    // Check for expiration
    const expirationTime = await key.getExpirationTime();
    const expiresAt = expirationTime ? expirationTime.toISOString() : undefined;

    // Get primary user ID
    const user = await key.getPrimaryUser();
    const comment = user?.user?.userID?.name || user?.user?.userID?.email;

    return {
      type: 'pgp',
      fingerprint,
      publicKey: armoredKey.trim(),
      keyId,
      comment,
      expiresAt,
      algorithm: key.getAlgorithmInfo().algorithm,
    };
  } catch (error: any) {
    throw new Error(`Failed to parse PGP key: ${error.message}`);
  }
}

/**
 * Parse and extract fingerprint from an SSH public key
 */
export function parseSSHKey(sshKey: string): ParsedKey {
  try {
    const trimmed = sshKey.trim();
    const parts = trimmed.split(/\s+/);

    if (parts.length < 2) {
      throw new Error('Invalid SSH key format');
    }

    const [algorithm, keyData, ...commentParts] = parts;
    const comment = commentParts.join(' ') || undefined;

    // Validate algorithm
    const validAlgorithms = [
      'ssh-rsa',
      'ssh-ed25519',
      'ecdsa-sha2-nistp256',
      'ecdsa-sha2-nistp384',
      'ecdsa-sha2-nistp521',
      'ssh-dss',
    ];

    if (!validAlgorithms.includes(algorithm)) {
      throw new Error(`Unsupported SSH key algorithm: ${algorithm}`);
    }

    // Calculate SHA256 fingerprint
    const keyBuffer = Buffer.from(keyData, 'base64');
    const hash = createHash('sha256').update(keyBuffer).digest('base64');
    const fingerprint = `SHA256:${hash}`;

    // Determine key type
    let keyType: string;
    if (algorithm === 'ssh-rsa') {
      keyType = 'ssh-rsa';
    } else if (algorithm === 'ssh-ed25519') {
      keyType = 'ssh-ed25519';
    } else if (algorithm.startsWith('ecdsa')) {
      keyType = 'ssh-ecdsa';
    } else {
      keyType = 'ssh';
    }

    return {
      type: keyType,
      fingerprint,
      publicKey: trimmed,
      comment,
      algorithm,
    };
  } catch (error: any) {
    throw new Error(`Failed to parse SSH key: ${error.message}`);
  }
}

/**
 * Parse an age public key
 */
export function parseAgeKey(ageKey: string): ParsedKey {
  try {
    const trimmed = ageKey.trim();

    // Age key format: age1{58 base64 characters}
    const pattern = /^age1[a-z0-9]{58}$/;
    if (!pattern.test(trimmed)) {
      throw new Error('Invalid age key format');
    }

    // Age keys are self-identifying, use the key itself as fingerprint
    const fingerprint = trimmed;

    return {
      type: 'age',
      fingerprint,
      publicKey: trimmed,
      algorithm: 'X25519',
    };
  } catch (error: any) {
    throw new Error(`Failed to parse age key: ${error.message}`);
  }
}

/**
 * Parse a minisign public key
 */
export function parseMinisignKey(minisignKey: string): ParsedKey {
  try {
    const lines = minisignKey.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('Invalid minisign key format');
    }

    // First line should be "untrusted comment: ..."
    // Second line is the actual key
    const keyLine = lines[lines.length - 1];

    if (!keyLine || keyLine.length < 40) {
      throw new Error('Invalid minisign key data');
    }

    // Extract key ID (first 8 bytes base64-encoded from the key)
    const fingerprint = keyLine.substring(0, 12);

    return {
      type: 'minisign',
      fingerprint,
      publicKey: minisignKey.trim(),
      comment: lines[0].replace(/^untrusted comment:\s*/, ''),
      algorithm: 'Ed25519',
    };
  } catch (error: any) {
    throw new Error(`Failed to parse minisign key: ${error.message}`);
  }
}

/**
 * Parse a signify public key (OpenBSD)
 */
export function parseSignifyKey(signifyKey: string): ParsedKey {
  try {
    const lines = signifyKey.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('Invalid signify key format');
    }

    // First line is comment, second line is base64 key
    const comment = lines[0].replace(/^untrusted comment:\s*/, '');
    const keyData = lines[1];

    if (!keyData || keyData.length < 40) {
      throw new Error('Invalid signify key data');
    }

    // Use first 12 chars as fingerprint
    const fingerprint = keyData.substring(0, 16);

    return {
      type: 'signify',
      fingerprint,
      publicKey: signifyKey.trim(),
      comment,
      algorithm: 'Ed25519',
    };
  } catch (error: any) {
    throw new Error(`Failed to parse signify key: ${error.message}`);
  }
}

/**
 * Parse a WireGuard public key
 */
export function parseWireGuardKey(wgKey: string): ParsedKey {
  try {
    const trimmed = wgKey.trim();

    // WireGuard key: 44 base64 characters
    const pattern = /^[A-Za-z0-9+\/]{42}[A-Za-z0-9+\/=]{2}$/;
    if (!pattern.test(trimmed)) {
      throw new Error('Invalid WireGuard key format');
    }

    // Use the key itself as fingerprint (it's already unique)
    const fingerprint = trimmed;

    return {
      type: 'wireguard',
      fingerprint,
      publicKey: trimmed,
      algorithm: 'Curve25519',
    };
  } catch (error: any) {
    throw new Error(`Failed to parse WireGuard key: ${error.message}`);
  }
}

/**
 * Auto-detect and parse any supported key type
 */
export async function parseKey(keyData: string): Promise<ParsedKey> {
  const trimmed = keyData.trim();

  // Try to detect key type
  if (trimmed.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    return await parsePGPKey(trimmed);
  } else if (trimmed.startsWith('ssh-') || trimmed.startsWith('ecdsa-')) {
    return parseSSHKey(trimmed);
  } else if (trimmed.startsWith('age1')) {
    return parseAgeKey(trimmed);
  } else if (trimmed.includes('untrusted comment') && trimmed.includes('minisign')) {
    return parseMinisignKey(trimmed);
  } else if (trimmed.includes('untrusted comment')) {
    return parseSignifyKey(trimmed);
  } else if (/^[A-Za-z0-9+\/]{43}=$/.test(trimmed)) {
    // Likely WireGuard (44 base64 chars with padding)
    return parseWireGuardKey(trimmed);
  }

  throw new Error('Unknown key format. Supported: PGP, SSH, age, minisign, signify, WireGuard');
}
```

**Dependencies:**
```bash
npm install openpgp
```

**Test file:** `server/lib/key-parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parsePGPKey, parseSSHKey, parseAgeKey, parseKey } from './key-parser';

describe('Key Parser', () => {
  describe('parseSSHKey', () => {
    it('should parse ssh-ed25519 key', () => {
      const key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN8h8P4fL7H3qE0l8fJKXZQV5V3bK7P5LxvJ8hKy9p8K alice@laptop';
      const result = parseSSHKey(key);

      expect(result.type).toBe('ssh-ed25519');
      expect(result.fingerprint).toMatch(/^SHA256:/);
      expect(result.comment).toBe('alice@laptop');
      expect(result.algorithm).toBe('ssh-ed25519');
    });

    it('should parse ssh-rsa key', () => {
      const key =
        'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7... user@host';
      const result = parseSSHKey(key);

      expect(result.type).toBe('ssh-rsa');
      expect(result.fingerprint).toMatch(/^SHA256:/);
    });

    it('should throw on invalid key', () => {
      expect(() => parseSSHKey('not a key')).toThrow();
    });
  });

  describe('parseAgeKey', () => {
    it('should parse valid age key', () => {
      const key = 'age1zvkyg2lqzraa2lnjvqej32nkuu0uesxnz1e4e8m2e8jl0e8e8jl0e8e';
      const result = parseAgeKey(key);

      expect(result.type).toBe('age');
      expect(result.fingerprint).toBe(key);
      expect(result.algorithm).toBe('X25519');
    });

    it('should throw on invalid age key', () => {
      expect(() => parseAgeKey('age1short')).toThrow();
    });
  });

  describe('parseKey (auto-detect)', () => {
    it('should auto-detect SSH key', async () => {
      const key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN8h8P4fL7H3qE0l8fJKXZQV5V3bK7P5LxvJ8hKy9p8K comment';
      const result = await parseKey(key);

      expect(result.type).toBe('ssh-ed25519');
    });

    it('should auto-detect age key', async () => {
      const key = 'age1zvkyg2lqzraa2lnjvqej32nkuu0uesxnz1e4e8m2e8jl0e8e8jl0e8e';
      const result = await parseKey(key);

      expect(result.type).toBe('age');
    });
  });
});
```

---

## Task 3.2: Key Upload API Route

### Location
Update file: `server/routes/keys.ts`

### Implementation

Replace the placeholder `POST /` endpoint:

```typescript
import { parseKey } from '../lib/key-parser';

/**
 * POST /api/keys
 * Publish a new public key
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { publicKey, label, comment } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: 'Missing required field: publicKey' });
    }

    // Parse and validate the key
    let parsed;
    try {
      parsed = await parseKey(publicKey);
    } catch (error: any) {
      return res.status(400).json({
        error: 'Invalid key format',
        message: error.message,
      });
    }

    // Create key record
    const agent = new AtpAgent({ service: session.pdsUrl });
    agent.session = session;

    const keyRecord = {
      keyType: parsed.type,
      fingerprint: parsed.fingerprint,
      publicKey: parsed.publicKey,
      label: label || undefined,
      comment: comment || parsed.comment || undefined,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const result = await createRecord(
      { agent, did: session.did },
      'me.attest.key',
      keyRecord
    );

    res.json({
      success: true,
      uri: result.uri,
      cid: result.cid,
      key: keyRecord,
      parsed,
    });
  } catch (error: any) {
    console.error('Error publishing key:', error);
    res.status(500).json({
      error: 'Failed to publish key',
      message: error.message,
    });
  }
});
```

---

## Task 3.3: Key Fetch API Endpoints

### Location
Update file: `server/routes/keys.ts`

Add these new endpoints:

```typescript
/**
 * GET /api/keys/:identifier/ssh
 * Fetch SSH public keys in OpenSSH format (like GitHub's /username.keys)
 * @param identifier - DID or handle (e.g., @alice.bsky.social)
 */
router.get('/:identifier/ssh', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    // Resolve identifier to DID
    let did: string;
    if (identifier.startsWith('did:')) {
      did = identifier;
    } else {
      // Handle format: @alice.bsky.social or alice.bsky.social
      const handle = identifier.replace(/^@/, '');
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      
      try {
        const resolved = await agent.resolveHandle({ handle });
        did = resolved.data.did;
      } catch (error) {
        return res.status(404).json({ error: 'Handle not found' });
      }
    }

    // Fetch all keys for this DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const result = await listRecords(agent, did, 'me.attest.key', 100);

    // Filter for SSH keys with status 'active'
    const sshKeys = result.records
      .filter((r: any) =>
        ['ssh-rsa', 'ssh-ed25519', 'ssh-ecdsa'].includes(r.value.keyType) &&
        r.value.status === 'active'
      )
      .map((r: any) => r.value.publicKey);

    if (sshKeys.length === 0) {
      return res.status(404).send('# No SSH keys found\n');
    }

    // Return as plain text, one key per line
    res.contentType('text/plain');
    res.send(sshKeys.join('\n') + '\n');
  } catch (error: any) {
    console.error('Error fetching SSH keys:', error);
    res.status(500).send(`# Error fetching SSH keys: ${error.message}\n`);
  }
});

/**
 * GET /api/keys/:identifier/pgp
 * Fetch PGP public keys in ASCII-armored format
 */
router.get('/:identifier/pgp', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    // Resolve identifier to DID
    let did: string;
    if (identifier.startsWith('did:')) {
      did = identifier;
    } else {
      const handle = identifier.replace(/^@/, '');
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      
      try {
        const resolved = await agent.resolveHandle({ handle });
        did = resolved.data.did;
      } catch (error) {
        return res.status(404).text('<!-- Handle not found -->');
      }
    }

    // Fetch all keys for this DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const result = await listRecords(agent, did, 'me.attest.key', 100);

    // Filter for PGP keys with status 'active'
    const pgpKeys = result.records
      .filter((r: any) => r.value.keyType === 'pgp' && r.value.status === 'active')
      .map((r: any) => r.value.publicKey);

    if (pgpKeys.length === 0) {
      return res.status(404).send('<!-- No PGP keys found -->\n');
    }

    // Return as plain text, keys separated by newlines
    res.contentType('text/plain');
    res.send(pgpKeys.join('\n\n') + '\n');
  } catch (error: any) {
    console.error('Error fetching PGP keys:', error);
    res.status(500).send(`<!-- Error fetching PGP keys: ${error.message} -->\n`);
  }
});

/**
 * GET /api/keys/:identifier/all
 * Fetch all public keys in structured JSON format
 */
router.get('/:identifier/all', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    // Resolve identifier to DID
    let did: string;
    if (identifier.startsWith('did:')) {
      did = identifier;
    } else {
      const handle = identifier.replace(/^@/, '');
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      
      try {
        const resolved = await agent.resolveHandle({ handle });
        did = resolved.data.did;
      } catch (error) {
        return res.status(404).json({ error: 'Handle not found' });
      }
    }

    // Fetch all keys for this DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const result = await listRecords(agent, did, 'me.attest.key', 100);

    // Filter for active keys
    const keys = result.records
      .filter((r: any) => r.value.status === 'active')
      .map((r: any) => ({
        uri: r.uri,
        keyType: r.value.keyType,
        fingerprint: r.value.fingerprint,
        publicKey: r.value.publicKey,
        label: r.value.label,
        comment: r.value.comment,
        createdAt: r.value.createdAt,
        expiresAt: r.value.expiresAt,
      }));

    res.json({
      did,
      keys,
      count: keys.length,
    });
  } catch (error: any) {
    console.error('Error fetching keys:', error);
    res.status(500).json({
      error: 'Failed to fetch keys',
      message: error.message,
    });
  }
});

/**
 * GET /:handle.keys
 * Shorthand for SSH keys (like GitHub)
 */
router.get('/:handle.keys', async (req: Request, res: Response) => {
  // Redirect to /api/keys/:handle/ssh
  const { handle } = req.params;
  req.params.identifier = handle;
  return router.handle(req, res);
});
```

---

## Task 3.4: Frontend - Key Upload Component

### Location
Create file: `src/components/KeyUpload.tsx`

### Implementation

```typescript
import React, { useState } from 'react';

interface KeyUploadProps {
  onSuccess: (keyData: any) => void;
}

export function KeyUpload({ onSuccess }: KeyUploadProps) {
  const [publicKey, setPublicKey] = useState('');
  const [label, setLabel] = useState('');
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyType, setKeyType] = useState<string | null>(null);

  const detectKeyType = (key: string): string | null => {
    const trimmed = key.trim();
    if (trimmed.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) return 'PGP';
    if (trimmed.startsWith('ssh-rsa')) return 'SSH RSA';
    if (trimmed.startsWith('ssh-ed25519')) return 'SSH Ed25519';
    if (trimmed.startsWith('ecdsa')) return 'SSH ECDSA';
    if (trimmed.startsWith('age1')) return 'age';
    if (trimmed.includes('minisign')) return 'minisign';
    if (trimmed.includes('untrusted comment')) return 'signify';
    if (/^[A-Za-z0-9+\/]{43}=$/.test(trimmed)) return 'WireGuard';
    return null;
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const key = e.target.value;
    setPublicKey(key);
    setKeyType(detectKeyType(key));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          publicKey,
          label: label || undefined,
          comment: comment || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to upload key');
      }

      const data = await response.json();
      onSuccess(data);

      // Reset form
      setPublicKey('');
      setLabel('');
      setComment('');
      setKeyType(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const loadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setPublicKey(text);
      setKeyType(detectKeyType(text));
      
      // Try to extract a label from the filename
      const filename = file.name.replace(/\.(pub|key|txt|asc)$/i, '');
      if (filename && !label) {
        setLabel(filename);
      }
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
    }
  };

  return (
    <div className="key-upload">
      <h2>Upload Public Key</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="publicKey">Public Key *</label>
          <textarea
            id="publicKey"
            value={publicKey}
            onChange={handleKeyChange}
            placeholder="Paste your public key here (PGP, SSH, age, minisign, signify, or WireGuard)"
            rows={10}
            required
            style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
          />
          
          {keyType && (
            <div className="key-type-detected" style={{ marginTop: '0.5rem', color: '#0066cc' }}>
              ✓ Detected: {keyType}
            </div>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              Load from file
              <input
                type="file"
                onChange={loadFromFile}
                accept=".pub,.key,.txt,.asc"
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="label">Label (optional)</label>
          <input
            type="text"
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., 'work laptop', 'signing key'"
            maxLength={128}
          />
        </div>

        <div className="form-group">
          <label htmlFor="comment">Comment (optional)</label>
          <input
            type="text"
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Additional notes about this key"
            maxLength={512}
          />
        </div>

        {error && (
          <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={uploading || !publicKey} className="btn-primary">
          {uploading ? 'Uploading...' : 'Upload Key'}
        </button>
      </form>

      <div className="help-section" style={{ marginTop: '2rem', fontSize: '0.9em', color: '#666' }}>
        <h3>Supported Key Types</h3>
        <ul>
          <li><strong>PGP/GPG:</strong> ASCII-armored public key (starts with -----BEGIN PGP PUBLIC KEY BLOCK-----)</li>
          <li><strong>SSH:</strong> OpenSSH format (ssh-rsa, ssh-ed25519, ecdsa-sha2-nistp256, etc.)</li>
          <li><strong>age:</strong> Modern encryption key (starts with age1)</li>
          <li><strong>minisign:</strong> Signature verification key</li>
          <li><strong>signify:</strong> OpenBSD signature key</li>
          <li><strong>WireGuard:</strong> VPN public key (44 base64 characters)</li>
        </ul>

        <h3>How to export your public keys</h3>
        <ul>
          <li><strong>SSH:</strong> <code>cat ~/.ssh/id_ed25519.pub</code></li>
          <li><strong>PGP:</strong> <code>gpg --armor --export your@email.com</code></li>
          <li><strong>age:</strong> <code>age-keygen -y ~/.age-key.txt</code></li>
          <li><strong>WireGuard:</strong> <code>wg show wg0 public-key</code></li>
        </ul>
      </div>
    </div>
  );
}
```

---

## Task 3.5: In-Browser Sign & Verify

### Location
Create files in `src/pages/SignVerifyPage.tsx` and components in `src/components/SignVerify/`

### File: `src/pages/SignVerifyPage.tsx`

```typescript
import React, { useState } from 'react';
import { SignForm } from '../components/SignVerify/SignForm';
import { VerifyForm } from '../components/SignVerify/VerifyForm';

export function SignVerifyPage() {
  const [activeTab, setActiveTab] = useState<'sign' | 'verify'>('sign');

  return (
    <div className="sign-verify-page">
      <h1>Sign & Verify Messages</h1>
      <p>
        Sign messages with your published keys or verify signed messages from others.
      </p>

      <div className="tabs">
        <button
          className={activeTab === 'sign' ? 'active' : ''}
          onClick={() => setActiveTab('sign')}
        >
          Sign
        </button>
        <button
          className={activeTab === 'verify' ? 'active' : ''}
          onClick={() => setActiveTab('verify')}
        >
          Verify
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'sign' ? <SignForm /> : <VerifyForm />}
      </div>
    </div>
  );
}
```

### File: `src/components/SignVerify/SignForm.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import * as openpgp from 'openpgp';

export function SignForm() {
  const [message, setMessage] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [signing, setSigning] = useState(false);
  const [signedMessage, setSignedMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [userKeys, setUserKeys] = useState<any[]>([]);
  const [selectedKeyUri, setSelectedKeyUri] = useState('');

  useEffect(() => {
    // Fetch user's published keys
    fetch('/api/keys/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setUserKeys(data.keys || []);
      })
      .catch((err) => {
        console.error('Failed to load keys:', err);
      });
  }, []);

  const handleSign = async () => {
    if (!message || !privateKey) {
      setError('Please provide both a message and your private key');
      return;
    }

    setSigning(true);
    setError(null);
    setSignedMessage('');

    try {
      // Parse private key
      const key = await openpgp.readPrivateKey({ armoredKey: privateKey });

      // Decrypt private key if encrypted
      let decryptedKey = key;
      if (key.isEncrypted() && passphrase) {
        decryptedKey = await openpgp.decryptKey({
          privateKey: key,
          passphrase,
        });
      } else if (key.isEncrypted()) {
        throw new Error('Private key is encrypted but no passphrase provided');
      }

      // Sign the message
      const signed = await openpgp.sign({
        message: await openpgp.createMessage({ text: message }),
        signingKeys: decryptedKey,
      });

      // Get public key fingerprint
      const publicKey = decryptedKey.toPublic();
      const fingerprint = publicKey.getFingerprint();

      // Find matching published key
      const matchingKey = userKeys.find((k) =>
        k.fingerprint?.toUpperCase() === fingerprint.toUpperCase()
      );

      const did = matchingKey ? 'YOUR_DID' : 'unknown'; // Replace with actual DID from session

      // Format output
      const output = `-----BEGIN ATTESTFOR.ME SIGNED MESSAGE-----
Signer: ${did}
Key: PGP ${fingerprint}
${matchingKey?.label ? `Label: ${matchingKey.label}` : ''}
Date: ${new Date().toISOString()}

${message}

${signed}
-----END ATTESTFOR.ME SIGNED MESSAGE-----`;

      setSignedMessage(output);
    } catch (err: any) {
      setError(`Signing failed: ${err.message}`);
    } finally {
      setSigning(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(signedMessage);
  };

  return (
    <div className="sign-form">
      <h2>Sign a Message</h2>

      <div className="form-group">
        <label>Message to Sign</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter the message you want to sign..."
          rows={6}
        />
      </div>

      <div className="form-group">
        <label>Your Private Key</label>
        <textarea
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="Paste your PGP private key here (it never leaves your browser)"
          rows={8}
          style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
        />
        <small style={{ color: '#666' }}>
          Your private key is processed entirely in your browser and is never sent to the server.
        </small>
      </div>

      <div className="form-group">
        <label>Passphrase (if key is encrypted)</label>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter passphrase if needed"
        />
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <button onClick={handleSign} disabled={signing || !message || !privateKey} className="btn-primary">
        {signing ? 'Signing...' : 'Sign Message'}
      </button>

      {signedMessage && (
        <div className="signed-output" style={{ marginTop: '2rem' }}>
          <h3>Signed Message</h3>
          <textarea
            value={signedMessage}
            readOnly
            rows={15}
            style={{ fontFamily: 'monospace', fontSize: '0.85em', width: '100%' }}
          />
          <button onClick={copyToClipboard} className="btn-secondary">
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}
```

### File: `src/components/SignVerify/VerifyForm.tsx`

```typescript
import React, { useState } from 'react';
import * as openpgp from 'openpgp';

export function VerifyForm() {
  const [signedMessage, setSignedMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!signedMessage) {
      setError('Please paste a signed message');
      return;
    }

    setVerifying(true);
    setError(null);
    setResult(null);

    try {
      // Parse the AttestFor.me signed message format
      const lines = signedMessage.split('\n');
      let did = '';
      let fingerprint = '';
      let messageStart = -1;
      let signatureStart = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Signer:')) {
          did = lines[i].replace('Signer:', '').trim();
        } else if (lines[i].startsWith('Key: PGP')) {
          fingerprint = lines[i].replace('Key: PGP', '').trim();
        } else if (lines[i] === '' && messageStart === -1 && did) {
          messageStart = i + 1;
        } else if (lines[i].startsWith('-----BEGIN PGP SIGNATURE-----')) {
          signatureStart = i;
          break;
        }
      }

      if (!fingerprint) {
        throw new Error('Could not parse signed message format');
      }

      // Verify the PGP signature
      const message = await openpgp.readMessage({
        armoredMessage: lines.slice(signatureStart).join('\n'),
      });

      // Fetch the public key from AttestFor.me
      const keysResponse = await fetch(`/api/keys/${did}/all`);
      if (!keysResponse.ok) {
        throw new Error('Could not fetch signer public keys');
      }

      const keysData = await keysResponse.json();
      const matchingKey = keysData.keys.find((k: any) =>
        k.fingerprint?.toUpperCase() === fingerprint.toUpperCase() && k.keyType === 'pgp'
      );

      if (!matchingKey) {
        throw new Error(`No matching key found for fingerprint ${fingerprint}`);
      }

      const publicKey = await openpgp.readKey({ armoredKey: matchingKey.publicKey });

      const verification = await openpgp.verify({
        message,
        verificationKeys: publicKey,
      });

      const { verified } = verification.signatures[0];
      await verified; // Will throw if invalid

      setResult({
        valid: true,
        signer: did,
        fingerprint,
        label: matchingKey.label,
        signedAt: lines.find((l) => l.startsWith('Date:'))?.replace('Date:', '').trim(),
      });
    } catch (err: any) {
      setError(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="verify-form">
      <h2>Verify a Signed Message</h2>

      <div className="form-group">
        <label>Signed Message</label>
        <textarea
          value={signedMessage}
          onChange={(e) => setSignedMessage(e.target.value)}
          placeholder="Paste the signed message here..."
          rows={15}
          style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
        />
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <button onClick={handleVerify} disabled={verifying || !signedMessage} className="btn-primary">
        {verifying ? 'Verifying...' : 'Verify Signature'}
      </button>

      {result && (
        <div className="verification-result" style={{ marginTop: '2rem', padding: '1rem', border: '2px solid #00cc00', borderRadius: '4px' }}>
          <h3 style={{ color: '#00cc00' }}>✓ Signature Valid</h3>
          <dl>
            <dt>Signer:</dt>
            <dd>{result.signer}</dd>
            <dt>Key Fingerprint:</dt>
            <dd style={{ fontFamily: 'monospace' }}>{result.fingerprint}</dd>
            {result.label && (
              <>
                <dt>Key Label:</dt>
                <dd>{result.label}</dd>
              </>
            )}
            <dt>Signed At:</dt>
            <dd>{result.signedAt}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
```

**Dependencies:**
```bash
npm install openpgp
```

---

## Acceptance Criteria

Phase 3 is complete when:

- [ ] Key parser library supports all key types (PGP, SSH, age, minisign, signify, WireGuard)
- [ ] `POST /api/keys` endpoint parses and validates keys correctly
- [ ] Key fingerprint extraction works for all key types
- [ ] `GET /api/keys/:identifier/ssh` returns SSH keys in OpenSSH format
- [ ] `GET /api/keys/:identifier/pgp` returns PGP keys in ASCII-armored format
- [ ] `GET /api/keys/:identifier/all` returns all keys in JSON format
- [ ] Key upload component in frontend works and auto-detects key types
- [ ] Sign form allows users to sign messages with PGP private keys (client-side only)
- [ ] Verify form validates signed messages and fetches signer's public key from repo
- [ ] All unit tests pass with >80% coverage
- [ ] Key fetch API can be used with `curl` and SSH `AuthorizedKeysCommand`
- [ ] Documentation is complete for all new endpoints

---

## Next Phase

Proceed to **Phase 4: Profile & Verification UI** after all acceptance criteria are met.
