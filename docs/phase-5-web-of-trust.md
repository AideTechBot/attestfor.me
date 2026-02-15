# Phase 5: Web of Trust — Detailed Implementation Guide

**Objective:** Implement a vouching/following system where users can verify others' identities and cryptographically sign attestations, building a decentralized web of trust graph.

**Prerequisites:**
- Phase 1 completed (lexicons, AT Proto library)
- Phase 2 completed (verification systems)
- Phase 3 completed (keys, signing)
- Phase 4 completed (profile UI)

---

## Task 5.1: Follow/Vouch Record Creation

### Location
Create file: `server/routes/follows.ts`

### Implementation

```typescript
import { Router, Request, Response } from 'express';
import { AtpAgent } from '@atproto/api';
import { createRecord, listRecords, deleteRecord } from '../lib/atproto-repo';
import { getSessionFromRequest } from '../oauth';
import * as openpgp from 'openpgp';

const router = Router();

/**
 * POST /api/follows
 * Create a follow/vouch record for another user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { targetDid, confidence, comment, signature, signingKeyUri } = req.body;

    if (!targetDid) {
      return res.status(400).json({ error: 'Missing required field: targetDid' });
    }

    if (!['low', 'medium', 'high'].includes(confidence)) {
      return res.status(400).json({ error: 'Invalid confidence level (must be low, medium, or high)' });
    }

    // Verify that the target DID exists
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    try {
      await agent.getProfile({ actor: targetDid });
    } catch {
      return res.status(404).json({ error: 'Target DID not found' });
    }

    // If signature provided, verify it
    let signatureData: any = undefined;
    if (signature && signingKeyUri) {
      try {
        // Fetch the signing key
        const { value: keyRecord } = await agent.com.atproto.repo.getRecord({
          repo: session.did,
          collection: 'me.attest.key',
          rkey: signingKeyUri.split('/').pop()!,
        });

        if (keyRecord.keyType !== 'pgp') {
          return res.status(400).json({ error: 'Only PGP keys can be used for signing vouches' });
        }

        // Verify the signature
        const vouchText = `I vouch for ${targetDid} with ${confidence} confidence.\n${comment || ''}`;
        const publicKey = await openpgp.readKey({ armoredKey: keyRecord.publicKey });
        const message = await openpgp.readMessage({ armoredMessage: signature });

        const verification = await openpgp.verify({
          message,
          verificationKeys: publicKey,
        });

        const { verified } = verification.signatures[0];
        await verified; // Will throw if invalid

        signatureData = {
          signature,
          signingKeyUri,
          fingerprint: keyRecord.fingerprint,
        };
      } catch (error: any) {
        return res.status(400).json({
          error: 'Signature verification failed',
          message: error.message,
        });
      }
    }

    // Create the follow record
    agent.session = session;

    const followRecord = {
      subject: targetDid,
      confidence, // 'low' | 'medium' | 'high'
      comment: comment || undefined,
      signature: signatureData?.signature,
      signingKeyUri: signatureData?.signingKeyUri,
      signingKeyFingerprint: signatureData?.fingerprint,
      createdAt: new Date().toISOString(),
    };

    const result = await createRecord(
      { agent, did: session.did },
      'me.attest.follow',
      followRecord
    );

    res.json({
      success: true,
      uri: result.uri,
      cid: result.cid,
      follow: followRecord,
    });
  } catch (error: any) {
    console.error('Error creating follow:', error);
    res.status(500).json({
      error: 'Failed to create follow',
      message: error.message,
    });
  }
});

/**
 * GET /api/follows/me
 * Get all users the authenticated user is following/vouching for
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const agent = new AtpAgent({ service: session.pdsUrl });
    agent.session = session;

    const result = await listRecords(agent, session.did, 'me.attest.follow', 100);

    const follows = result.records.map((r: any) => ({
      uri: r.uri,
      ...r.value,
    }));

    res.json({ follows });
  } catch (error: any) {
    console.error('Error fetching follows:', error);
    res.status(500).json({
      error: 'Failed to fetch follows',
      message: error.message,
    });
  }
});

/**
 * GET /api/follows/:did
 * Get all users who are following/vouching for the specified DID
 */
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;

    // In a production system, you'd need a reverse index
    // For now, this is a simplified implementation
    // You'd query: "Find all me.attest.follow records where subject = {did}"

    // This would require an indexing service or database
    // Placeholder response:
    res.json({
      did,
      followers: [],
      message: 'Follower indexing not yet implemented. This requires a centralized indexer or crawling.',
    });
  } catch (error: any) {
    console.error('Error fetching followers:', error);
    res.status(500).json({
      error: 'Failed to fetch followers',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/follows/:uri
 * Remove a follow/vouch
 */
router.delete('/:uri', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { uri } = req.params;

    const agent = new AtpAgent({ service: session.pdsUrl });
    agent.session = session;

    await deleteRecord({ agent, did: session.did }, uri);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting follow:', error);
    res.status(500).json({
      error: 'Failed to delete follow',
      message: error.message,
    });
  }
});

export default router;
```

---

## Task 5.2: Trust Badge Component

### Location
Create file: `src/components/TrustBadge.tsx`

### Implementation

```typescript
import React, { useEffect, useState } from 'react';

interface TrustBadgeProps {
  did: string;
  currentUserDid?: string;
}

interface TrustData {
  directVouches: number;
  transitiveVouches: number;
  highConfidenceVouches: number;
  mutualFollows: number;
}

export function TrustBadge({ did, currentUserDid }: TrustBadgeProps) {
  const [trustData, setTrustData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrustData();
  }, [did, currentUserDid]);

  const loadTrustData = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/trust/${did}?viewer=${currentUserDid || ''}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTrustData(data);
      }
    } catch (error) {
      console.error('Failed to load trust data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!trustData || trustData.directVouches === 0) {
    return null;
  }

  const getTrustLevel = (): { label: string; color: string } => {
    if (trustData.highConfidenceVouches >= 3) {
      return { label: 'Highly Trusted', color: '#00aa00' };
    } else if (trustData.directVouches >= 2) {
      return { label: 'Trusted', color: '#0066cc' };
    } else if (trustData.directVouches >= 1) {
      return { label: 'Vouched', color: '#6699cc' };
    }
    return { label: 'Unknown', color: '#999' };
  };

  const trust = getTrustLevel();

  return (
    <div className="trust-badge" style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      background: `${trust.color}15`,
      border: `1px solid ${trust.color}`,
      borderRadius: '8px',
      fontSize: '0.9em',
    }}>
      <span style={{ fontSize: '1.2em' }}>🛡️</span>
      <div>
        <strong style={{ color: trust.color }}>{trust.label}</strong>
        <div style={{ fontSize: '0.85em', color: '#666' }}>
          {trustData.directVouches} {trustData.directVouches === 1 ? 'person you trust vouches' : 'people you trust vouch'} for this identity
          {trustData.transitiveVouches > 0 && ` (+${trustData.transitiveVouches} indirect)`}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 5.3: Vouch Creation Modal

### Location
Create file: `src/components/VouchModal.tsx`

### Implementation

```typescript
import React, { useState, useEffect } from 'react';
import * as openpgp from 'openpgp';

interface VouchModalProps {
  targetDid: string;
  targetHandle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function VouchModal({ targetDid, targetHandle, onClose, onSuccess }: VouchModalProps) {
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [comment, setComment] = useState('');
  const [signVouch, setSignVouch] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [userKeys, setUserKeys] = useState<any[]>([]);
  const [selectedKeyUri, setSelectedKeyUri] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user's PGP keys
    fetch('/api/keys/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const pgpKeys = data.keys?.filter((k: any) => k.keyType === 'pgp') || [];
        setUserKeys(pgpKeys);
        if (pgpKeys.length > 0) {
          setSelectedKeyUri(pgpKeys[0].uri);
        }
      })
      .catch((err) => {
        console.error('Failed to load keys:', err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let signature: string | undefined;

      // If signing, generate signature
      if (signVouch && privateKey) {
        const vouchText = `I vouch for ${targetDid} with ${confidence} confidence.\n${comment}`;

        const key = await openpgp.readPrivateKey({ armoredKey: privateKey });
        let decryptedKey = key;

        if (key.isEncrypted() && passphrase) {
          decryptedKey = await openpgp.decryptKey({
            privateKey: key,
            passphrase,
          });
        } else if (key.isEncrypted()) {
          throw new Error('Private key is encrypted but no passphrase provided');
        }

        const signed = await openpgp.sign({
          message: await openpgp.createMessage({ text: vouchText }),
          signingKeys: decryptedKey,
        });

        signature = signed;
      }

      // Submit vouch
      const response = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetDid,
          confidence,
          comment: comment || undefined,
          signature,
          signingKeyUri: signVouch ? selectedKeyUri : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to create vouch');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Vouch for @{targetHandle}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Confidence Level</label>
            <select value={confidence} onChange={(e) => setConfidence(e.target.value as any)}>
              <option value="low">Low - I've briefly interacted with this person</option>
              <option value="medium">Medium - I know this person and trust their identity</option>
              <option value="high">High - I've verified this person's identity in-person or through strong proof</option>
            </select>
          </div>

          <div className="form-group">
            <label>Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why are you vouching for this person?"
              rows={3}
              maxLength={500}
            />
            <small>{comment.length}/500</small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={signVouch}
                onChange={(e) => setSignVouch(e.target.checked)}
              />
              Cryptographically sign this vouch with my PGP key
            </label>
          </div>

          {signVouch && (
            <>
              {userKeys.length > 0 ? (
                <div className="form-group">
                  <label>Signing Key</label>
                  <select value={selectedKeyUri} onChange={(e) => setSelectedKeyUri(e.target.value)}>
                    {userKeys.map((key) => (
                      <option key={key.uri} value={key.uri}>
                        {key.label || key.fingerprint.substring(0, 16)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="warning">
                  You don't have any PGP keys published yet. <a href="/keys">Add a key</a> to sign your vouch.
                </div>
              )}

              <div className="form-group">
                <label>Private Key</label>
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="Paste your PGP private key (it never leaves your browser)"
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
                />
                <small>Your private key is processed entirely in your browser.</small>
              </div>

              <div className="form-group">
                <label>Passphrase (if encrypted)</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter passphrase"
                />
              </div>
            </>
          )}

          {error && (
            <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting || (signVouch && !privateKey)} className="btn-primary">
              {submitting ? 'Submitting...' : 'Vouch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**CSS:** Add to stylesheet:

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}
```

---

## Task 5.4: Trust Calculation API

### Location
Create file: `server/routes/trust.ts`

### Implementation

```typescript
import { Router, Request, Response } from 'express';
import { AtpAgent } from '@atproto/api';
import { listRecords } from '../lib/atproto-repo';

const router = Router();

/**
 * GET /api/trust/:did
 * Calculate trust metrics for a DID
 */
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { viewer } = req.query;

    if (!viewer) {
      return res.json({
        directVouches: 0,
        transitiveVouches: 0,
        highConfidenceVouches: 0,
        mutualFollows: 0,
      });
    }

    // Fetch viewer's follows
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const viewerFollowsResult = await listRecords(agent, viewer as string, 'me.attest.follow', 100);
    const viewerFollows = viewerFollowsResult.records.map((r: any) => r.value.subject);

    // In a production system, this would query an index for:
    // "All me.attest.follow records where subject = {did}"
    // For this example, we'll use a simplified approach

    // Calculate metrics
    let directVouches = 0;
    let highConfidenceVouches = 0;
    let transitiveVouches = 0;

    // Check if any of the viewer's follows also follow the target DID
    for (const followedDid of viewerFollows) {
      try {
        const theirFollowsResult = await listRecords(agent, followedDid, 'me.attest.follow', 100);
        const theirFollows = theirFollowsResult.records;

        for (const follow of theirFollows) {
          if (follow.value.subject === did) {
            directVouches++;
            if (follow.value.confidence === 'high') {
              highConfidenceVouches++;
            }
          }
        }
      } catch {
        // User may not have any follows
        continue;
      }
    }

    // Transitive vouches would require deeper graph traversal
    // Placeholder for now
    transitiveVouches = 0;

    // Check mutual follows
    let mutualFollows = 0;
    try {
      const targetFollowsResult = await listRecords(agent, did, 'me.attest.follow', 100);
      const targetFollows = targetFollowsResult.records.map((r: any) => r.value.subject);

      mutualFollows = viewerFollows.filter((f: string) => targetFollows.includes(f)).length;
    } catch {
      mutualFollows = 0;
    }

    res.json({
      directVouches,
      transitiveVouches,
      highConfidenceVouches,
      mutualFollows,
    });
  } catch (error: any) {
    console.error('Error calculating trust:', error);
    res.status(500).json({
      error: 'Failed to calculate trust',
      message: error.message,
    });
  }
});

/**
 * GET /api/trust/:did/graph
 * Get the trust graph for visualization
 */
router.get('/:did/graph', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { depth = '2' } = req.query;

    // Build a trust graph starting from the given DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    
    const nodes: any[] = [{ id: did, label: did }];
    const edges: any[] = [];

    // Fetch follows from the target DID (depth 1)
    try {
      const followsResult = await listRecords(agent, did, 'me.attest.follow', 100);

      for (const follow of followsResult.records) {
        const targetDid = follow.value.subject;
        nodes.push({ id: targetDid, label: targetDid });
        edges.push({
          from: did,
          to: targetDid,
          confidence: follow.value.confidence,
          comment: follow.value.comment,
        });
      }
    } catch {
      // No follows
    }

    // Could expand to depth 2+ by recursively following
    // For simplicity, only doing depth 1 here

    res.json({
      nodes,
      edges,
    });
  } catch (error: any) {
    console.error('Error building trust graph:', error);
    res.status(500).json({
      error: 'Failed to build trust graph',
      message: error.message,
    });
  }
});

export default router;
```

---

## Task 5.5: Following/Followers List Page

### Location
Create file: `src/pages/TrustNetworkPage.tsx`

### Implementation

```typescript
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface Follow {
  uri: string;
  subject: string;
  confidence: string;
  comment?: string;
  createdAt: string;
  signature?: string;
}

export function TrustNetworkPage() {
  const { did } = useParams<{ did: string }>();
  const [following, setFollowing] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFollowing();
  }, [did]);

  const loadFollowing = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/follows/${did}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load trust network');
      }

      const data = await response.json();
      setFollowing(data.follows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      high: { bg: '#e6ffe6', color: '#00aa00', label: 'High Confidence' },
      medium: { bg: '#e6f2ff', color: '#0066cc', label: 'Medium Confidence' },
      low: { bg: '#fff4e6', color: '#cc6600', label: 'Low Confidence' },
    };

    const style = styles[confidence] || styles.medium;

    return (
      <span style={{
        background: style.bg,
        color: style.color,
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.85em',
        fontWeight: 600,
      }}>
        {style.label}
      </span>
    );
  };

  if (loading) {
    return <div>Loading trust network...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="trust-network-page">
      <h1>Trust Network</h1>
      <p>People vouched for by this identity</p>

      {following.length === 0 ? (
        <div className="empty-state">
          <p>This user hasn't vouched for anyone yet.</p>
        </div>
      ) : (
        <div className="following-list">
          {following.map((follow) => (
            <div key={follow.uri} className="follow-card">
              <div className="follow-header">
                <a href={`/profile/${follow.subject}`} className="follow-did">
                  {follow.subject}
                </a>
                {getConfidenceBadge(follow.confidence)}
              </div>

              {follow.comment && (
                <div className="follow-comment">
                  "{follow.comment}"
                </div>
              )}

              <div className="follow-meta">
                <span>
                  Vouched: {new Date(follow.createdAt).toLocaleDateString()}
                </span>
                {follow.signature && (
                  <span style={{ color: '#00aa00' }}>✓ Cryptographically signed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**CSS:**

```css
.follow-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.follow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.follow-did {
  font-family: monospace;
  font-size: 0.9em;
  color: #0066cc;
  text-decoration: none;
}

.follow-did:hover {
  text-decoration: underline;
}

.follow-comment {
  font-style: italic;
  color: #666;
  margin-bottom: 0.5rem;
}

.follow-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85em;
  color: #666;
}
```

---

## Task 5.6: Trust Graph Visualization (Optional)

### Location
Create file: `src/components/TrustGraph.tsx`

### Implementation

This uses a simple visualization library like `react-force-graph-2d`:

```typescript
import React, { useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface TrustGraphProps {
  did: string;
}

export function TrustGraph({ did }: TrustGraphProps) {
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGraph();
  }, [did]);

  const loadGraph = async () => {
    try {
      const response = await fetch(`/api/trust/${did}/graph`);
      const data = await response.json();

      // Transform to force-graph format
      const graphData = {
        nodes: data.nodes.map((n: any) => ({
          id: n.id,
          label: n.label,
        })),
        links: data.edges.map((e: any) => ({
          source: e.from,
          target: e.to,
          confidence: e.confidence,
        })),
      };

      setGraphData(graphData);
    } catch (error) {
      console.error('Failed to load graph:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading trust graph...</div>;
  }

  if (!graphData) {
    return <div>No trust data available</div>;
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ForceGraph2D
        graphData={graphData}
        nodeLabel="label"
        nodeAutoColorBy="id"
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        linkColor={(link: any) => {
          const colors: Record<string, string> = {
            high: '#00aa00',
            medium: '#0066cc',
            low: '#cc6600',
          };
          return colors[link.confidence] || '#999';
        }}
      />
    </div>
  );
}
```

**Dependencies:**
```bash
npm install react-force-graph-2d openpgp
```

---

## Task 5.7: Vouch Button in Profile Page

### Location
Update file: `src/pages/ProfilePage.tsx`

Add this to the profile actions section:

```typescript
import { VouchModal } from '../components/VouchModal';

// Inside ProfilePage component:
const [showVouchModal, setShowVouchModal] = useState(false);

// In the profile-actions div:
<button className="btn-primary" onClick={() => setShowVouchModal(true)}>
  Vouch for this Identity
</button>

{showVouchModal && (
  <VouchModal
    targetDid={profile.did}
    targetHandle={profile.handle}
    onClose={() => setShowVouchModal(false)}
    onSuccess={loadProfile}
  />
)}
```

---

## Acceptance Criteria

Phase 5 is complete when:

- [ ] Users can vouch for other identities with confidence levels (low, medium, high)
- [ ] Vouches can be cryptographically signed with PGP keys
- [ ] Trust badges appear on profiles showing vouch counts
- [ ] Trust calculation API computes direct and transitive trust
- [ ] Trust network page shows all follows/vouches
- [ ] Vouch modal allows signing with published PGP keys
- [ ] Trust graph visualization displays relationships (optional)
- [ ] `POST /api/follows` endpoint creates vouch records
- [ ] `GET /api/follows/:did` endpoint returns followers (with indexer)
- [ ] `DELETE /api/follows/:uri` removes vouches
- [ ] All unit tests pass with >80% coverage
- [ ] UI components are styled consistently
- [ ] Documentation is complete

---

## Next Phase

Proceed to **Phase 6: Hardware Keys + Advanced Features** after all acceptance criteria are met.
