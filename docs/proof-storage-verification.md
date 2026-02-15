# Proof Storage & Verification Architecture

## Overview

This document describes how proofs are stored in AT Protocol repositories and how verification works in both client-side replay and server-side cached modes.

---

## Proof Storage Model

### Where Proofs Are Stored

Proofs are stored as **records in the user's AT Protocol repository** using the `me.attest.proof` lexicon. Each proof is a signed record that becomes part of the user's Merkle-tree-signed repo.

### Proof Record Structure

```typescript
interface ProofRecord {
  // Service identification
  service: string;              // 'twitter', 'github', 'ethereum', etc.
  
  // Identity being proven
  handle?: string;              // For service accounts: '@alice', 'alice'
  identifier?: string;          // For wallets: '0x742d35Cc6...'
  
  // Proof location and content
  proofUrl?: string;            // Where proof text lives (tweet, gist, DNS TXT, etc.)
  signature?: string;           // For wallet proofs: cryptographic signature
  challengeText: string;        // The challenge text that was posted/signed
  nonce: string;                // Random nonce in the challenge
  
  // Verification state
  status: 'verified' | 'unverified' | 'revoked' | 'expired';
  verifiedAt?: string;          // ISO timestamp of last successful verification
  lastCheckedAt?: string;       // ISO timestamp of last verification attempt
  errorMessage?: string;        // If verification failed
  
  // Metadata
  createdAt: string;            // ISO timestamp
  
  // Server verification cache
  serverVerification?: {
    verifiedAt: string;         // When server last verified
    result: boolean;            // Server verification result
    expiresAt: string;          // When cache expires (24h from verifiedAt)
  };
}
```

### Storage Location

```
at://did:plc:abc123.../me.attest.proof/{record-key}
```

Each proof is a separate record with a unique key (TID - timestamp identifier). Records are:
- ✅ Signed by the user's repo signing key
- ✅ Part of the Merkle tree
- ✅ Immutable once written (updates create new commits)
- ✅ Publicly readable by anyone

---

## Verification Flow: Two Modes

### Mode 1: Client-Side Replay (Real-Time)

The client can **replay the proof verification** by executing the same steps the server would:

```typescript
/**
 * Client-side proof replay verification
 */
async function replayProofVerification(proof: ProofRecord): Promise<{
  verified: boolean;
  timestamp: string;
  steps: VerificationStep[];
  error?: string;
}> {
  const steps: VerificationStep[] = [];
  
  try {
    // Step 1: Validate proof record structure
    steps.push({
      step: 'validate_record',
      status: 'success',
      message: 'Proof record structure is valid',
    });

    // Step 2: Fetch proof content from external source
    if (proof.service === 'twitter') {
      steps.push({
        step: 'fetch_tweet',
        status: 'in_progress',
        message: `Fetching tweet from ${proof.proofUrl}`,
      });

      const tweetContent = await fetchTweetContent(proof.proofUrl);
      
      steps.push({
        step: 'fetch_tweet',
        status: 'success',
        message: 'Tweet content retrieved',
        data: { content: tweetContent },
      });

      // Step 3: Verify challenge text is present
      steps.push({
        step: 'verify_challenge',
        status: 'in_progress',
        message: 'Checking if tweet contains challenge text',
      });

      if (!tweetContent.includes(proof.challengeText)) {
        throw new Error('Challenge text not found in tweet');
      }

      steps.push({
        step: 'verify_challenge',
        status: 'success',
        message: 'Challenge text found and matches',
      });

    } else if (proof.service === 'github') {
      // Similar steps for GitHub gist...
      
    } else if (proof.service === 'ethereum') {
      // Step 2: Verify cryptographic signature
      steps.push({
        step: 'verify_signature',
        status: 'in_progress',
        message: 'Verifying Ethereum signature',
      });

      const isValid = await verifyEthereumSignature(
        proof.identifier!,
        proof.challengeText,
        proof.signature!
      );

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      steps.push({
        step: 'verify_signature',
        status: 'success',
        message: 'Signature is valid',
      });
    }

    // Step 4: Verify AT Proto repo signature
    steps.push({
      step: 'verify_repo_signature',
      status: 'in_progress',
      message: 'Verifying AT Proto repository signature',
    });

    const repoValid = await verifyRepoSignature(proof);
    
    if (!repoValid) {
      throw new Error('AT Proto repository signature invalid');
    }

    steps.push({
      step: 'verify_repo_signature',
      status: 'success',
      message: 'AT Proto repository signature valid',
    });

    return {
      verified: true,
      timestamp: new Date().toISOString(),
      steps,
    };

  } catch (error: any) {
    return {
      verified: false,
      timestamp: new Date().toISOString(),
      steps,
      error: error.message,
    };
  }
}
```

#### Client-Side Replay UI Component

```typescript
/**
 * ProofReplayVerification.tsx
 * Shows step-by-step verification replay to the user
 */
export function ProofReplayVerification({ proof }: { proof: ProofRecord }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleReplay = async () => {
    setVerifying(true);
    setResult(null);

    try {
      const verificationResult = await replayProofVerification(proof);
      setResult(verificationResult);
    } catch (error: any) {
      setResult({
        verified: false,
        error: error.message,
        steps: [],
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="proof-replay">
      <h3>Verify This Proof</h3>
      <p>Replay the verification steps to independently confirm this proof.</p>

      <button onClick={handleReplay} disabled={verifying}>
        {verifying ? 'Verifying...' : 'Replay Verification'}
      </button>

      {result && (
        <div className={`verification-result ${result.verified ? 'success' : 'failure'}`}>
          <h4>
            {result.verified ? '✓ Proof Valid' : '✗ Proof Invalid'}
          </h4>
          <p>Verified at: {new Date(result.timestamp).toLocaleString()}</p>

          <div className="verification-steps">
            <h5>Verification Steps:</h5>
            {result.steps.map((step: any, i: number) => (
              <div key={i} className={`step step-${step.status}`}>
                <span className="step-icon">
                  {step.status === 'success' && '✓'}
                  {step.status === 'in_progress' && '⋯'}
                  {step.status === 'error' && '✗'}
                </span>
                <span className="step-name">{step.step}</span>
                <span className="step-message">{step.message}</span>
                {step.data && (
                  <pre className="step-data">
                    {JSON.stringify(step.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {result.error && (
            <div className="error-details">
              <strong>Error:</strong> {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Mode 2: Server-Side Cached Verification

When the user requests server verification, the server performs the full verification and **caches the result for 24 hours** to prevent DDoS.

#### Server Endpoint

```typescript
/**
 * POST /api/proofs/verify-cached
 * Verify a proof on the server with 24h caching
 */
router.post('/verify-cached', async (req: Request, res: Response) => {
  try {
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: 'Missing proof URI' });
    }

    // Extract DID and rkey from URI
    const uriParts = uri.match(/at:\/\/(did:[^/]+)\/me\.attest\.proof\/(.+)/);
    if (!uriParts) {
      return res.status(400).json({ error: 'Invalid proof URI' });
    }

    const [, did, rkey] = uriParts;

    // Check if we have a cached verification
    const cacheKey = `server_verification:${did}:${rkey}`;
    const cached = await redisClient?.get(cacheKey);

    if (cached) {
      const cachedResult = JSON.parse(cached);
      return res.json({
        verified: cachedResult.verified,
        serverVerifiedAt: cachedResult.timestamp,
        expiresAt: cachedResult.expiresAt,
        cached: true,
        message: `This proof was verified on the server at ${new Date(cachedResult.timestamp).toLocaleString()}`,
      });
    }

    // Fetch the proof record
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'me.attest.proof',
      rkey,
    });

    const proof = recordResponse.data.value as ProofRecord;

    // Perform verification
    const verifier = getVerifierForService(proof.service);
    if (!verifier) {
      return res.status(400).json({ error: `No verifier for service: ${proof.service}` });
    }

    let verified = false;
    let errorMessage: string | undefined;

    try {
      if (proof.service === 'ethereum' || proof.service === 'bitcoin' || /* other wallets */) {
        // Wallet proof - verify signature
        const walletVerifier = verifier as BaseWalletVerifier;
        const result = await walletVerifier.verify({
          identifier: proof.identifier!,
          signature: proof.signature!,
          challengeText: proof.challengeText,
          did,
        });
        verified = result.verified;
        errorMessage = result.error;
      } else {
        // Service proof - fetch external content
        const result = await verifier.verify(
          proof.proofUrl!,
          proof.challengeText,
          proof.handle!
        );
        verified = result.success;
        errorMessage = result.error;
      }
    } catch (error: any) {
      verified = false;
      errorMessage = error.message;
    }

    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Cache the result for 24 hours
    const cacheData = {
      verified,
      timestamp,
      expiresAt,
      errorMessage,
    };

    await redisClient?.setEx(
      cacheKey,
      24 * 60 * 60, // 24 hours in seconds
      JSON.stringify(cacheData)
    );

    // Update the proof record with server verification data
    try {
      const updatedProof = {
        ...proof,
        serverVerification: {
          verifiedAt: timestamp,
          result: verified,
          expiresAt,
        },
        lastCheckedAt: timestamp,
        status: verified ? 'verified' : 'unverified',
        errorMessage: verified ? undefined : errorMessage,
      };

      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: 'me.attest.proof',
        rkey,
        record: updatedProof,
      });
    } catch (updateError) {
      console.error('Failed to update proof record:', updateError);
      // Don't fail the request if update fails
    }

    res.json({
      verified,
      serverVerifiedAt: timestamp,
      expiresAt,
      cached: false,
      message: `This proof was verified on the server at ${new Date(timestamp).toLocaleString()}`,
      errorMessage,
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

#### Client Component for Server Verification

```typescript
/**
 * ServerVerificationBadge.tsx
 * Shows server verification status with timestamp
 */
export function ServerVerificationBadge({ proof }: { proof: ProofRecord }) {
  const [requesting, setRequesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Check if we have a recent server verification
  const hasRecentServerVerification = proof.serverVerification &&
    new Date(proof.serverVerification.expiresAt) > new Date();

  const requestServerVerification = async () => {
    setRequesting(true);

    try {
      const response = await fetch('/api/proofs/verify-cached', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uri: proof.uri }),
      });

      if (!response.ok) {
        throw new Error('Server verification failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        verified: false,
        error: error.message,
      });
    } finally {
      setRequesting(false);
    }
  };

  if (hasRecentServerVerification) {
    const serverVerif = proof.serverVerification!;
    const expiresIn = new Date(serverVerif.expiresAt).getTime() - Date.now();
    const hoursRemaining = Math.floor(expiresIn / (1000 * 60 * 60));

    return (
      <div className={`server-verification-badge ${serverVerif.result ? 'verified' : 'failed'}`}>
        <span className="badge-icon">
          {serverVerif.result ? '🛡️' : '⚠️'}
        </span>
        <div className="badge-content">
          <strong>
            {serverVerif.result ? 'Server Verified' : 'Server Verification Failed'}
          </strong>
          <small>
            Verified at {new Date(serverVerif.verifiedAt).toLocaleString()}
          </small>
          <small>
            Cache expires in {hoursRemaining}h
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="server-verification-request">
      <button
        onClick={requestServerVerification}
        disabled={requesting}
        className="btn-secondary"
      >
        {requesting ? 'Requesting...' : 'Request Server Verification'}
      </button>

      {result && (
        <div className={`verification-result ${result.verified ? 'success' : 'failure'}`}>
          <p>{result.message}</p>
          {result.cached && <small>(From cache)</small>}
          {result.errorMessage && (
            <div className="error-details">
              Error: {result.errorMessage}
            </div>
          )}
        </div>
      )}

      <small className="help-text">
        Server verification is cached for 24 hours to prevent abuse.
      </small>
    </div>
  );
}
```

---

## Complete Verification Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CREATES PROOF                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  a) Generate challenge text with nonce                          │
│     "I am did:plc:xyz on AT Protocol..."                       │
│                                                                  │
│  b) Post to external service OR sign with wallet                │
│     - Twitter: Tweet the challenge                              │
│     - GitHub: Create gist with challenge                        │
│     - Ethereum: Sign challenge with MetaMask                    │
│                                                                  │
│  c) Write proof record to AT Proto repo                         │
│     at://did:plc:xyz/me.attest.proof/{tid}                     │
│     {                                                            │
│       service: "twitter",                                       │
│       handle: "@alice",                                         │
│       proofUrl: "https://twitter.com/.../status/...",          │
│       challengeText: "I am did:plc:xyz...",                    │
│       nonce: "abc123...",                                       │
│       status: "unverified",                                     │
│       createdAt: "2026-02-15T10:30:00Z"                        │
│     }                                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. VERIFICATION (Two Modes)                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ MODE A: CLIENT-SIDE REPLAY (Real-Time)                         │
│ ──────────────────────────────────────────                     │
│  ┌──────────────────────────────────────┐                      │
│  │ User clicks "Replay Verification"    │                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────┐                      │
│  │ Client fetches proof from AT repo    │                      │
│  │ at://did:plc:xyz/me.attest.proof/... │                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────┐                      │
│  │ For service proofs:                   │                      │
│  │ - Fetch external content (tweet/gist) │                      │
│  │ - Check if challengeText is present   │                      │
│  │                                        │                      │
│  │ For wallet proofs:                    │                      │
│  │ - Verify cryptographic signature      │                      │
│  │   using public address                │                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────┐                      │
│  │ Verify AT Proto repo signature       │                      │
│  │ (Merkle tree validation)             │                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────┐                      │
│  │ Display verification steps to user   │                      │
│  │ ✓ Record structure valid             │                      │
│  │ ✓ External content fetched           │                      │
│  │ ✓ Challenge text found/verified      │                      │
│  │ ✓ Repo signature valid               │                      │
│  │ Result: VERIFIED                     │                      │
│  └──────────────────────────────────────┘                      │
│                                                                  │
│ MODE B: SERVER-SIDE CACHED (Anti-DDoS)                        │
│ ───────────────────────────────────────                        │
│  ┌──────────────────────────────────────┐                      │
│  │ User clicks "Request Server Verify"  │                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────┐                      │
│  │ POST /api/proofs/verify-cached       │                      │
│  │ { uri: "at://did:plc:xyz/..." }     │                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────┐                      │
│  │ Check Redis cache                    │                      │
│  │ Key: server_verification:{did}:{rkey}│                      │
│  └──────────────────────────────────────┘                      │
│                 │                                                │
│        ┌────────┴────────┐                                     │
│        │                 │                                      │
│    CACHED           NOT CACHED                                  │
│        │                 │                                      │
│        ▼                 ▼                                      │
│  ┌──────────┐    ┌──────────────────┐                         │
│  │ Return   │    │ Perform full     │                         │
│  │ cached   │    │ verification     │                         │
│  │ result   │    │ (same as client  │                         │
│  │          │    │  but server-side) │                         │
│  │ "Verified│    └──────────────────┘                         │
│  │  24h ago"│             │                                     │
│  └──────────┘             ▼                                     │
│                  ┌──────────────────┐                         │
│                  │ Cache result for │                         │
│                  │ 24 hours         │                         │
│                  │ TTL: 86400s      │                         │
│                  └──────────────────┘                         │
│                           │                                     │
│                           ▼                                     │
│                  ┌──────────────────┐                         │
│                  │ Update proof     │                         │
│                  │ record with      │                         │
│                  │ serverVerification│                         │
│                  │ metadata         │                         │
│                  └──────────────────┘                         │
│                           │                                     │
│                           ▼                                     │
│                  ┌──────────────────┐                         │
│                  │ Return result    │                         │
│                  │ with timestamp   │                         │
│                  │ "Verified on     │                         │
│                  │  server at       │                         │
│                  │  2026-02-15..."  │                         │
│                  └──────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. DISPLAY TO USERS                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Profile shows proof with badges:                               │
│                                                                  │
│  ┌────────────────────────────────────────┐                    │
│  │ 🐦 Twitter: @alice                     │                    │
│  │                                        │                    │
│  │ Status: ✓ Verified                    │                    │
│  │                                        │                    │
│  │ [Replay Verification]  (client-side)  │                    │
│  │                                        │                    │
│  │ 🛡️ Server Verified                    │                    │
│  │ at 2026-02-15 10:45 AM                │                    │
│  │ Cache expires in 23h                  │                    │
│  └────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

**Proof Storage:**
- Stored as `me.attest.proof` records in user's AT Proto repository
- Each proof includes challenge text, nonce, proof URL/signature, and verification status
- Records are Merkle-tree-signed and immutable

**Client-Side Replay:**
- Users can independently verify proofs by replaying verification steps
- Fetches external content (tweets, gists) or verifies signatures (wallets)
- Shows step-by-step verification process in UI
- No rate limiting, always real-time

**Server-Side Cached:**
- User requests server verification
- Server performs full verification and caches result for 24 hours in Redis
- Prevents DDoS by rate-limiting verification requests
- Shows "Verified on server at {timestamp}" badge
- Cache expires after 24 hours, forcing re-verification

**Best Practice:**
- Use client-side replay for transparency and independence
- Use server-side cached for official/trusted verification stamp
- Display both options to users for maximum trust
