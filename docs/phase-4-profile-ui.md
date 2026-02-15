# Phase 4: Profile & Verification UI — Detailed Implementation Guide

**Objective:** Build two distinct profile views (simple LinkTree-style and detailed technical view), implement verification status UI, create proof status badges, and build public verification report pages.

**Prerequisites:**
- Phase 1 completed (lexicons, AT Proto library, API routes)
- Phase 2 completed (proof/wallet verification)
- Phase 3 completed (keys, sign & verify)

---

## Overview: Two Profile Views

AttestFor.me provides **two distinct profile routes** to serve different audiences:

1. **Simple Profile** (`/[handle]`) — LinkTree-style interface for non-technical users
   - Clean, minimal design with large account cards
   - Shows verified accounts with visual checkmarks
   - No technical jargon, DIDs, or cryptographic details
   - Target: General users, recruiters, collaborators

2. **Technical Details Profile** (`/[handle]/details`) — Full verification dashboard
   - Shows DID, public keys, detailed proof information
   - Client-side replay and server verification
   - Signed statements and web of trust data
   - Export capabilities and re-verification actions
   - Target: Developers, security researchers, auditors

---

## Task 4.1: Simple Profile Page (LinkTree-Style)

### Location
Create file: `src/pages/ProfilePage.tsx`

### Implementation

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SimpleProofCard } from '../components/Profile/SimpleProofCard';

interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  proofs: any[];
  keys: any[];
  statements: any[];
  profile?: any;
}

export function ProfilePage() {
  const { identifier } = useParams<{ identifier: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [identifier]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/profile/${identifier}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page loading">
        <div className="spinner">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page not-found">
        <h2>Profile Not Found</h2>
        <p>The user {identifier} could not be found.</p>
      </div>
    );
  }

  const verifiedProofsCount = profile.proofs.filter((p) => p.status === 'verified').length;
  const totalProofsCount = profile.proofs.length;

  return (
    <div className="profile-page simple">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.displayName || profile.handle} />
          ) : (
            <div className="avatar-placeholder-large">
              {(profile.displayName || profile.handle).charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className="profile-name">{profile.displayName || profile.handle}</h1>
        <p className="profile-handle">@{profile.handle}</p>

        {profile.profile?.description && (
          <p className="profile-bio">{profile.profile.description}</p>
        )}

        <div className="verification-summary">
          <span className="verified-badge">
            ✓ {verifiedProofsCount} Verified Account{verifiedProofsCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Verified Accounts Grid (LinkTree-style) */}
      <div className="accounts-grid">
        {profile.proofs.length === 0 ? (
          <div className="empty-state">
            <p>No verified accounts yet.</p>
          </div>
        ) : (
          profile.proofs.map((proof: any) => (
            <SimpleProofCard key={proof.uri} proof={proof} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="profile-footer">
        <Link to={`/${identifier}/details`} className="details-link">
          🔍 View Technical Details →
        </Link>
        
        <button 
          className="share-button"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Profile link copied to clipboard!');
          }}
        >
          📋 Share Profile
        </button>
      </div>
    </div>
  );
}
```

**CSS for Simple Profile:** Add to `src/index.css`:

```css
.profile-page.simple {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
  text-align: center;
}

.profile-avatar-large {
  width: 120px;
  height: 120px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #eee;
}

.profile-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder-large {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 3rem;
  font-weight: bold;
}

.profile-name {
  font-size: 2rem;
  font-weight: 700;
  margin: 0.5rem 0 0.25rem;
}

.profile-handle {
  font-size: 1.1rem;
  color: #666;
  margin: 0;
}

.profile-bio {
  margin: 1rem 0;
  color: #444;
  line-height: 1.6;
}

.verification-summary {
  margin: 1.5rem 0;
}

.verified-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #e6ffe6;
  color: #00aa00;
  border-radius: 24px;
  font-weight: 600;
  border: 2px solid #00aa00;
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.profile-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.details-link {
  color: #0066cc;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
}

.details-link:hover {
  text-decoration: underline;
}

.share-button {
  background: none;
  border: 1px solid #ddd;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.share-button:hover {
  background: #f5f5f5;
  border-color: #999;
}
```

---

## Task 4.2: Simple Proof Card Component (LinkTree-Style)

### Location
Create file: `src/components/Profile/SimpleProofCard.tsx`

### Implementation

```typescript
import React from 'react';

interface SimpleProofCardProps {
  proof: any;
}

export function SimpleProofCard({ proof }: SimpleProofCardProps) {
  const getServiceIcon = () => {
    const service = proof.service;
    const icons: Record<string, string> = {
      github: '🐙',
      twitter: '🐦',
      dns: '🌐',
      https: '🔒',
      ethereum: '💎',
      bitcoin: '₿',
      solana: '◎',
      mastodon: '🦣',
      reddit: '🤖',
      hackernews: '🟧',
      linkedin: '💼',
    };
    return icons[service] || '🔗';
  };

  const getServiceName = () => {
    const nameMap: Record<string, string> = {
      github: 'GitHub',
      twitter: 'Twitter/X',
      dns: 'DNS',
      https: 'Website',
      ethereum: 'Ethereum',
      bitcoin: 'Bitcoin',
      solana: 'Solana',
      mastodon: 'Mastodon',
      reddit: 'Reddit',
      hackernews: 'Hacker News',
      linkedin: 'LinkedIn',
    };
    return nameMap[proof.service] || proof.service;
  };

  const getTargetUrl = () => {
    // For service proofs, link to the actual service profile
    switch (proof.service) {
      case 'github':
        return `https://github.com/${proof.handle}`;
      case 'twitter':
        return `https://twitter.com/${proof.handle}`;
      case 'reddit':
        return `https://reddit.com/u/${proof.handle}`;
      case 'hackernews':
        return `https://news.ycombinator.com/user?id=${proof.handle}`;
      case 'linkedin':
        return `https://linkedin.com/in/${proof.handle}`;
      case 'mastodon':
        return proof.proofUrl; // Mastodon profiles vary by instance
      case 'ethereum':
        return `https://etherscan.io/address/${proof.handle}`;
      case 'bitcoin':
        return `https://blockstream.info/address/${proof.handle}`;
      case 'solana':
        return `https://solscan.io/account/${proof.handle}`;
      case 'dns':
      case 'https':
        return proof.proofUrl;
      default:
        return proof.proofUrl || '#';
    }
  };

  const isVerified = proof.status === 'verified';

  return (
    <a 
      href={getTargetUrl()} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`simple-proof-card ${isVerified ? 'verified' : 'unverified'}`}
    >
      <div className="card-icon">{getServiceIcon()}</div>
      <div className="card-content">
        <div className="card-service-name">{getServiceName()}</div>
        <div className="card-handle">{proof.handle || proof.identifier}</div>
      </div>
      <div className="card-status">
        {isVerified ? (
          <span className="status-badge verified">✓</span>
        ) : (
          <span className="status-badge unverified">⚠</span>
        )}
      </div>
    </a>
  );
}
```

**CSS:** Add to `src/index.css`:

```css
.simple-proof-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: white;
  border: 2px solid #eee;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  cursor: pointer;
}

.simple-proof-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.simple-proof-card.verified {
  border-color: #00aa00;
  background: #fafffe;
}

.simple-proof-card.unverified {
  border-color: #ffaa00;
  background: #fffef9;
}

.card-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  text-align: left;
  min-width: 0;
}

.card-service-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.card-handle {
  font-size: 0.9rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-status {
  flex-shrink: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1.2rem;
}

.status-badge.verified {
  background: #00aa00;
  color: white;
}

.status-badge.unverified {
  background: #ffaa00;
  color: white;
}
```

---

## Task 4.3: Technical Details Profile Page

### Location
Create file: `src/pages/ProfileDetailsPage.tsx`

### Implementation

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DetailedProofCard } from '../components/Profile/DetailedProofCard';
import { KeyCard } from '../components/Profile/KeyCard';
import { StatementCard } from '../components/Profile/StatementCard';
import { VerificationReport } from '../components/Profile/VerificationReport';

interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  proofs: any[];
  keys: any[];
  statements: any[];
  profile?: any;
}

export function ProfileDetailsPage() {
  const { identifier } = useParams<{ identifier: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'proofs' | 'keys' | 'statements'>('proofs');
  const [reverifyingAll, setReverifyingAll] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [identifier]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/profile/${identifier}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReverifyAll = async () => {
    if (!profile) return;

    setReverifyingAll(true);

    try {
      // Re-verify all proofs
      await Promise.all(
        profile.proofs.map((proof) =>
          fetch('/api/proofs/verify-cached', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ uri: proof.uri }),
          })
        )
      );

      // Reload profile
      await loadProfile();
      alert('All proofs re-verified successfully!');
    } catch (err: any) {
      alert(`Re-verification failed: ${err.message}`);
    } finally {
      setReverifyingAll(false);
    }
  };

  const copyDID = () => {
    if (profile) {
      navigator.clipboard.writeText(profile.did);
      alert('DID copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="profile-details-page loading">
        <div className="spinner">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-details-page error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-details-page not-found">
        <h2>Profile Not Found</h2>
        <p>The user {identifier} could not be found.</p>
      </div>
    );
  }

  const verifiedProofsCount = profile.proofs.filter((p) => p.status === 'verified').length;
  const totalProofsCount = profile.proofs.length;

  return (
    <div className="profile-details-page">
      {/* Back Link */}
      <div className="back-link">
        <Link to={`/${identifier}`}>← Back to Simple Profile</Link>
      </div>

      {/* Profile Header */}
      <div className="profile-header-technical">
        <div className="profile-avatar">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.displayName || profile.handle} />
          ) : (
            <div className="avatar-placeholder">
              {(profile.displayName || profile.handle).charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="profile-info">
          <h1>{profile.displayName || profile.handle}</h1>
          <p className="handle">@{profile.handle}</p>
          
          <div className="did-section">
            <label>DID (Decentralized Identifier):</label>
            <div className="did-display">
              <code>{profile.did}</code>
              <button className="btn-icon" onClick={copyDID} title="Copy DID">
                📋
              </button>
            </div>
          </div>

          <div className="verification-stats">
            <span className="stat">
              <strong>{verifiedProofsCount}</strong> / {totalProofsCount} proofs verified
            </span>
            <span className="stat">
              <strong>{profile.keys.length}</strong> public keys
            </span>
            <span className="stat">
              <strong>{profile.statements.length}</strong> signed statements
            </span>
          </div>

          <div className="profile-actions">
            <button 
              className="btn-primary" 
              onClick={handleReverifyAll}
              disabled={reverifyingAll || profile.proofs.length === 0}
            >
              {reverifyingAll ? 'Re-verifying...' : '🔄 Re-verify All Proofs'}
            </button>
            
            <VerificationReport profile={profile} />
            
            <button 
              className="btn-secondary" 
              onClick={() => window.open(`/api/keys/${identifier}/ssh`, '_blank')}
            >
              View SSH Keys
            </button>
            
            <button 
              className="btn-secondary" 
              onClick={() => window.open(`/api/keys/${identifier}/pgp`, '_blank')}
            >
              View PGP Keys
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={activeTab === 'proofs' ? 'active' : ''}
          onClick={() => setActiveTab('proofs')}
        >
          Proofs ({profile.proofs.length})
        </button>
        <button
          className={activeTab === 'keys' ? 'active' : ''}
          onClick={() => setActiveTab('keys')}
        >
          Public Keys ({profile.keys.length})
        </button>
        <button
          className={activeTab === 'statements' ? 'active' : ''}
          onClick={() => setActiveTab('statements')}
        >
          Statements ({profile.statements.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="profile-content">
        {activeTab === 'proofs' && (
          <div className="proofs-list">
            {profile.proofs.length === 0 ? (
              <div className="empty-state">
                <p>No proofs have been added yet.</p>
              </div>
            ) : (
              profile.proofs.map((proof: any) => (
                <DetailedProofCard key={proof.uri} proof={proof} onUpdate={loadProfile} />
              ))
            )}
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="keys-list">
            {profile.keys.length === 0 ? (
              <div className="empty-state">
                <p>No public keys have been published yet.</p>
              </div>
            ) : (
              profile.keys.map((key: any) => (
                <KeyCard key={key.uri} keyData={key} />
              ))
            )}
          </div>
        )}

        {activeTab === 'statements' && (
          <div className="statements-list">
            {profile.statements.length === 0 ? (
              <div className="empty-state">
                <p>No signed statements yet.</p>
              </div>
            ) : (
              profile.statements.map((statement: any) => (
                <StatementCard key={statement.uri} statement={statement} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**CSS for Technical Details Profile:** Add to `src/index.css`:

```css
.profile-details-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.back-link {
  margin-bottom: 1.5rem;
}

.back-link a {
  color: #0066cc;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
}

.back-link a:hover {
  text-decoration: underline;
}

.profile-header-technical {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #eee;
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #ddd;
  flex-shrink: 0;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 2.5rem;
  font-weight: bold;
}

.profile-info {
  flex: 1;
}

.profile-info h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
}

.profile-info .handle {
  font-size: 1.2rem;
  color: #666;
  margin: 0 0 1rem;
}

.did-section {
  margin: 1rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.did-section label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.did-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.did-display code {
  flex: 1;
  padding: 0.5rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  word-break: break-all;
}

.btn-icon {
  background: none;
  border: 1px solid #ddd;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #e6e6e6;
  border-color: #999;
}

.verification-stats {
  display: flex;
  gap: 2rem;
  margin: 1.5rem 0;
  font-size: 0.95rem;
}

.verification-stats .stat {
  color: #666;
}

.verification-stats .stat strong {
  color: #000;
  font-size: 1.2rem;
}

.profile-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.btn-primary {
  background: #0066cc;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #0052a3;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #0066cc;
  border: 2px solid #0066cc;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e6f2ff;
}

.profile-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #eee;
}

.profile-tabs button {
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  color: #666;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.profile-tabs button:hover {
  color: #000;
}

.profile-tabs button.active {
  color: #0066cc;
  border-bottom-color: #0066cc;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.empty-state p {
  font-size: 1.1rem;
}
```

---

## Task 4.4: Detailed Proof Card (for Technical View)

### Location
Create file: `src/components/Profile/DetailedProofCard.tsx`

### Implementation

This is the same as the ProofCard from earlier, but renamed for clarity. It includes the full technical details, client-side replay, and server verification badges.

```typescript
import React, { useState } from 'react';
import { ProofReplayVerification } from '../ProofReplayVerification';
import { ServerVerificationBadge } from '../ServerVerificationBadge';

interface DetailedProofCardProps {
  proof: any;
  onUpdate?: () => void;
}

export function DetailedProofCard({ proof, onUpdate }: DetailedProofCardProps) {
  const [reverifying, setReverifying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = () => {
    switch (proof.status) {
      case 'verified':
        return <span className="badge badge-verified">✓ Verified</span>;
      case 'unverified':
        return <span className="badge badge-unverified">⚠ Unverified</span>;
      case 'revoked':
        return <span className="badge badge-revoked">✗ Revoked</span>;
      case 'expired':
        return <span className="badge badge-expired">⌛ Expired</span>;
      default:
        return <span className="badge badge-pending">⋯ Pending</span>;
    }
  };

  const getServiceIcon = () => {
    const service = proof.service;
    const icons: Record<string, string> = {
      github: '🐙',
      twitter: '🐦',
      dns: '🌐',
      https: '🔒',
      ethereum: '💎',
      bitcoin: '₿',
      solana: '◎',
    };
    return icons[service] || '🔗';
  };

  const handleReverify = async () => {
    if (!proof.uri) return;

    setReverifying(true);

    try {
      const response = await fetch('/api/proofs/reverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uri: proof.uri }),
      });

      if (!response.ok) {
        throw new Error('Re-verification failed');
      }

      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      alert(`Re-verification failed: ${err.message}`);
    } finally {
      setReverifying(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`proof-card proof-${proof.status}`}>
      <div className="proof-header">
        <div className="proof-service">
          <span className="service-icon">{getServiceIcon()}</span>
          <span className="service-name">{proof.service}</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="proof-identity">
        <strong>{proof.handle || proof.identifier}</strong>
      </div>

      {proof.proofUrl && (
        <div className="proof-url">
          <a href={proof.proofUrl} target="_blank" rel="noopener noreferrer">
            {proof.proofUrl}
          </a>
        </div>
      )}

      <div className="proof-dates">
        <span>Created: {formatDate(proof.createdAt)}</span>
        {proof.verifiedAt && <span>Verified: {formatDate(proof.verifiedAt)}</span>}
        {proof.lastCheckedAt && <span>Last checked: {formatDate(proof.lastCheckedAt)}</span>}
      </div>

      <div className="proof-actions">
        <button className="btn-link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>

        {proof.status === 'verified' && (
          <button className="btn-link" onClick={handleReverify} disabled={reverifying}>
            {reverifying ? 'Re-verifying...' : 'Re-verify'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="proof-details">
          <dl>
            <dt>URI:</dt>
            <dd style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all' }}>
              {proof.uri}
            </dd>

            {proof.serverVerification && (
              <>
                <dt>Server Verification:</dt>
                <dd>
                  Result: {proof.serverVerification.result ? '✓ Verified' : '✗ Failed'}
                  <br />
                  Verified at: {new Date(proof.serverVerification.verifiedAt).toLocaleString()}
                  <br />
                  Expires: {new Date(proof.serverVerification.expiresAt).toLocaleString()}
                </dd>
              </>
            )}

            {proof.errorMessage && (
              <>
                <dt>Error:</dt>
                <dd style={{ color: '#cc0000' }}>{proof.errorMessage}</dd>
              </>
            )}

            {proof.signature && (
              <>
                <dt>Signature:</dt>
                <dd style={{ fontFamily: 'monospace', fontSize: '0.75em', wordBreak: 'break-all' }}>
                  {proof.signature}
                </dd>
              </>
            )}

            {proof.challengeText && (
              <>
                <dt>Challenge Text:</dt>
                <dd style={{ fontFamily: 'monospace', fontSize: '0.85em', whiteSpace: 'pre-wrap' }}>
                  {proof.challengeText}
                </dd>
              </>
            )}
          </dl>

          {/* Import verification components from Phase 2 */}
          <div className="verification-methods" style={{ marginTop: '1.5rem' }}>
            <h4>Verification Methods</h4>
            
            {/* Client-side replay verification */}
            <ProofReplayVerification proof={proof} />

            {/* Server-side cached verification */}
            <div style={{ marginTop: '1rem' }}>
              <ServerVerificationBadge proof={proof} onUpdate={onUpdate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**CSS:** Add to `src/index.css`:

```css
.proof-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s;
}

## Task 4.2: Proof Card Component with Status Badges

### Location
Create file: `src/components/Profile/ProofCard.tsx`

### Implementation

```typescript
import React, { useState } from 'react';

interface ProofCardProps {
  proof: any;
  onUpdate?: () => void;
}

export function ProofCard({ proof, onUpdate }: ProofCardProps) {
  const [reverifying, setReverifying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = () => {
    switch (proof.status) {
      case 'verified':
        return <span className="badge badge-verified">✓ Verified</span>;
      case 'unverified':
        return <span className="badge badge-unverified">⚠ Unverified</span>;
      case 'revoked':
        return <span className="badge badge-revoked">✗ Revoked</span>;
      case 'expired':
        return <span className="badge badge-expired">⌛ Expired</span>;
      default:
        return <span className="badge badge-pending">⋯ Pending</span>;
    }
  };

  const getServiceIcon = () => {
    const service = proof.service;
    const icons: Record<string, string> = {
      github: '🐙',
      twitter: '🐦',
      dns: '🌐',
      https: '🔒',
      ethereum: '💎',
      bitcoin: '₿',
      solana: '◎',
    };
    return icons[service] || '🔗';
  };

  const handleReverify = async () => {
    if (!proof.uri) return;

    setReverifying(true);

    try {
      const response = await fetch('/api/proofs/reverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uri: proof.uri }),
      });

      if (!response.ok) {
        throw new Error('Re-verification failed');
      }

      // Reload profile
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      alert(`Re-verification failed: ${err.message}`);
    } finally {
      setReverifying(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`proof-card proof-${proof.status}`}>
      <div className="proof-header">
        <div className="proof-service">
          <span className="service-icon">{getServiceIcon()}</span>
          <span className="service-name">{proof.service}</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="proof-identity">
        <strong>{proof.handle || proof.identifier}</strong>
      </div>

      {proof.proofUrl && (
        <div className="proof-url">
          <a href={proof.proofUrl} target="_blank" rel="noopener noreferrer">
            {proof.proofUrl}
          </a>
        </div>
      )}

      <div className="proof-dates">
        <span>Created: {formatDate(proof.createdAt)}</span>
        {proof.verifiedAt && <span>Verified: {formatDate(proof.verifiedAt)}</span>}
        {proof.lastCheckedAt && <span>Last checked: {formatDate(proof.lastCheckedAt)}</span>}
      </div>

      <div className="proof-actions">
        <button className="btn-link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>

        {proof.status === 'verified' && (
          <button className="btn-link" onClick={handleReverify} disabled={reverifying}>
            {reverifying ? 'Re-verifying...' : 'Re-verify'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="proof-details">
          <dl>
            <dt>URI:</dt>
            <dd style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all' }}>
              {proof.uri}
            </dd>

            {proof.serverVerification && (
              <>
                <dt>Server Verification:</dt>
                <dd>
                  Result: {proof.serverVerification.result ? '✓ Verified' : '✗ Failed'}
                  <br />
                  Verified at: {new Date(proof.serverVerification.verifiedAt).toLocaleString()}
                  <br />
                  Expires: {new Date(proof.serverVerification.expiresAt).toLocaleString()}
                </dd>
              </>
            )}

            {proof.errorMessage && (
              <>
                <dt>Error:</dt>
                <dd style={{ color: '#cc0000' }}>{proof.errorMessage}</dd>
              </>
            )}

            {proof.signature && (
              <>
                <dt>Signature:</dt>
                <dd style={{ fontFamily: 'monospace', fontSize: '0.75em', wordBreak: 'break-all' }}>
                  {proof.signature}
                </dd>
              </>
            )}

            {proof.challengeText && (
              <>
                <dt>Challenge Text:</dt>
                <dd style={{ fontFamily: 'monospace', fontSize: '0.85em', whiteSpace: 'pre-wrap' }}>
                  {proof.challengeText}
                </dd>
              </>
            )}
          </dl>

          {/* Import verification components from Phase 2 */}
          <div className="verification-methods" style={{ marginTop: '1.5rem' }}>
            <h4>Verification Methods</h4>
            
            {/* Client-side replay verification */}
            <ProofReplayVerification proof={proof} />

            {/* Server-side cached verification */}
            <div style={{ marginTop: '1rem' }}>
              <ServerVerificationBadge proof={proof} onUpdate={onUpdate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Imports:** Add to top of ProofCard.tsx:

```typescript
import { ProofReplayVerification } from '../ProofReplayVerification';
import { ServerVerificationBadge } from '../ServerVerificationBadge';
```

**CSS:** Add to `src/index.css` or component stylesheet:

```css
.proof-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s;
}

.proof-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.proof-card.proof-verified {
  border-left: 4px solid #00cc00;
}

.proof-card.proof-unverified {
  border-left: 4px solid #ff9900;
}

.proof-card.proof-revoked {
  border-left: 4px solid #cc0000;
  opacity: 0.7;
}

.proof-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.proof-service {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.service-icon {
  font-size: 1.5em;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 600;
}

.badge-verified {
  background: #e6ffe6;
  color: #00aa00;
}

.badge-unverified {
  background: #fff4e6;
  color: #cc6600;
}

.badge-revoked {
  background: #ffe6e6;
  color: #cc0000;
}

.badge-expired {
  background: #f0f0f0;
  color: #666;
}

.badge-pending {
  background: #e6f2ff;
  color: #0066cc;
}

.proof-identity {
  font-size: 1.1em;
  margin-bottom: 0.5rem;
}

.proof-url {
  margin-bottom: 0.5rem;
  font-size: 0.9em;
}

.proof-url a {
  color: #0066cc;
  text-decoration: none;
}

.proof-url a:hover {
  text-decoration: underline;
}

.proof-dates {
  display: flex;
  gap: 1rem;
  font-size: 0.85em;
  color: #666;
  margin-bottom: 0.5rem;
}

.proof-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.btn-link {
  background: none;
  border: none;
  color: #0066cc;
  cursor: pointer;
  font-size: 0.9em;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link:disabled {
  color: #999;
  cursor: not-allowed;
}

.proof-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.proof-details dl {
  margin: 0;
}

.proof-details dt {
  font-weight: 600;
  margin-top: 0.5rem;
}

.proof-details dd {
  margin: 0.25rem 0 0 0;
}
```

---

## Task 4.3: Key Card Component

### Location
Create file: `src/components/Profile/KeyCard.tsx`

### Implementation

```typescript
import React, { useState } from 'react';

interface KeyCardProps {
  keyData: any;
}

export function KeyCard({ keyData }: KeyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const getKeyIcon = () => {
    const icons: Record<string, string> = {
      'pgp': '🔐',
      'ssh-rsa': '🔑',
      'ssh-ed25519': '🔑',
      'ssh-ecdsa': '🔑',
      'age': '📦',
      'minisign': '✍️',
      'signify': '✍️',
      'wireguard': '🔒',
    };
    return icons[keyData.keyType] || '🔑';
  };

  const getKeyTypeLabel = () => {
    const labels: Record<string, string> = {
      'pgp': 'PGP/GPG',
      'ssh-rsa': 'SSH RSA',
      'ssh-ed25519': 'SSH Ed25519',
      'ssh-ecdsa': 'SSH ECDSA',
      'age': 'age',
      'minisign': 'minisign',
      'signify': 'signify',
      'wireguard': 'WireGuard',
    };
    return labels[keyData.keyType] || keyData.keyType;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(keyData.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = keyData.expiresAt && new Date(keyData.expiresAt) < new Date();

  return (
    <div className={`key-card ${isExpired ? 'key-expired' : ''}`}>
      <div className="key-header">
        <div className="key-type">
          <span className="key-icon">{getKeyIcon()}</span>
          <span className="key-type-label">{getKeyTypeLabel()}</span>
        </div>
        {keyData.label && <span className="key-label">{keyData.label}</span>}
      </div>

      <div className="key-fingerprint">
        <strong>Fingerprint:</strong>
        <code>{keyData.fingerprint}</code>
      </div>

      {keyData.comment && (
        <div className="key-comment">
          {keyData.comment}
        </div>
      )}

      <div className="key-dates">
        <span>Added: {formatDate(keyData.createdAt)}</span>
        {keyData.expiresAt && (
          <span className={isExpired ? 'expired' : ''}>
            {isExpired ? 'Expired' : 'Expires'}: {formatDate(keyData.expiresAt)}
          </span>
        )}
      </div>

      <div className="key-actions">
        <button className="btn-link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide Key' : 'Show Key'}
        </button>
        <button className="btn-link" onClick={copyToClipboard}>
          {copied ? 'Copied!' : 'Copy Key'}
        </button>
      </div>

      {expanded && (
        <div className="key-content">
          <pre style={{ fontSize: '0.75em', overflow: 'auto', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
            {keyData.publicKey}
          </pre>
        </div>
      )}
    </div>
  );
}
```

**CSS:** Add to stylesheet:

```css
.key-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.key-card.key-expired {
  opacity: 0.6;
  border-left: 4px solid #cc6600;
}

.key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.key-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.key-icon {
  font-size: 1.5em;
}

.key-label {
  background: #e6f2ff;
  color: #0066cc;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85em;
}

.key-fingerprint {
  margin-bottom: 0.5rem;
  font-size: 0.9em;
}

.key-fingerprint code {
  display: block;
  font-family: monospace;
  font-size: 0.85em;
  margin-top: 0.25rem;
  padding: 0.25rem;
  background: #f5f5f5;
  border-radius: 4px;
  word-break: break-all;
}

.key-comment {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 0.5rem;
}

.key-dates {
  display: flex;
  gap: 1rem;
  font-size: 0.85em;
  color: #666;
  margin-bottom: 0.5rem;
}

.key-dates .expired {
  color: #cc6600;
  font-weight: 600;
}

.key-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}
```

---

## Task 4.4: Statement Card Component

### Location
Create file: `src/components/Profile/StatementCard.tsx`

### Implementation

```typescript
import React, { useState } from 'react';

interface StatementCardProps {
  statement: any;
}

export function StatementCard({ statement }: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const handleVerify = async () => {
    setVerifying(true);

    try {
      const response = await fetch('/api/statements/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: statement.uri }),
      });

      const result = await response.json();
      setVerificationResult(result);
    } catch (err: any) {
      setVerificationResult({ valid: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="statement-card">
      <div className="statement-header">
        <span className="statement-icon">📝</span>
        <span className="statement-title">{statement.title || 'Signed Statement'}</span>
      </div>

      <div className="statement-content">
        <p style={{ whiteSpace: 'pre-wrap', margin: '0.5rem 0' }}>
          {expanded ? statement.content : `${statement.content.substring(0, 200)}${statement.content.length > 200 ? '...' : ''}`}
        </p>
        {statement.content.length > 200 && (
          <button className="btn-link" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      <div className="statement-meta">
        <span>Signed: {formatDate(statement.createdAt)}</span>
        {statement.keyFingerprint && (
          <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
            Key: {statement.keyFingerprint.substring(0, 16)}...
          </span>
        )}
      </div>

      <div className="statement-actions">
        <button className="btn-secondary" onClick={handleVerify} disabled={verifying}>
          {verifying ? 'Verifying...' : 'Verify Signature'}
        </button>
      </div>

      {verificationResult && (
        <div className={`verification-result ${verificationResult.valid ? 'valid' : 'invalid'}`}>
          {verificationResult.valid ? (
            <span>✓ Signature is valid</span>
          ) : (
            <span>✗ Signature verification failed: {verificationResult.error}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.5: Verification Report Component

### Location
Create file: `src/components/Profile/VerificationReport.tsx`

### Implementation

```typescript
import React, { useState } from 'react';

interface VerificationReportProps {
  profile: any;
}

export function VerificationReport({ profile }: VerificationReportProps) {
  const [generating, setGenerating] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  const generateReport = async () => {
    setGenerating(true);

    try {
      const response = await fetch(`/api/profile/${profile.did}/report`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      setReportUrl(data.reportUrl);

      // Open in new tab
      window.open(data.reportUrl, '_blank');
    } catch (err: any) {
      alert(`Failed to generate report: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="verification-report">
      <button className="btn-primary" onClick={generateReport} disabled={generating}>
        {generating ? 'Generating...' : 'Export Verification Report'}
      </button>

      {reportUrl && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9em' }}>
          <a href={reportUrl} target="_blank" rel="noopener noreferrer">
            View Report
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## Task 4.6: Profile API Endpoint

### Location
Create file: `server/routes/profile.ts`

### Implementation

```typescript
import { Router, Request, Response } from 'express';
import { AtpAgent } from '@atproto/api';
import { listRecords } from '../lib/atproto-repo';

const router = Router();

/**
 * GET /api/profile/:identifier
 * Fetch complete profile with all proofs, keys, and statements
 */
router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    // Resolve identifier to DID
    let did: string;
    let handle: string;
    
    if (identifier.startsWith('did:')) {
      did = identifier;
      // Resolve DID to handle
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      try {
        const profile = await agent.getProfile({ actor: did });
        handle = profile.data.handle;
      } catch {
        handle = did;
      }
    } else {
      handle = identifier.replace(/^@/, '');
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      const resolved = await agent.resolveHandle({ handle });
      did = resolved.data.did;
    }

    // Fetch AT Proto profile
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    let bskyProfile;
    try {
      const profileRes = await agent.getProfile({ actor: did });
      bskyProfile = profileRes.data;
    } catch {
      bskyProfile = null;
    }

    // Fetch all records in parallel
    const [proofsResult, keysResult, statementsResult, profileResult] = await Promise.all([
      listRecords(agent, did, 'me.attest.proof', 100),
      listRecords(agent, did, 'me.attest.key', 100),
      listRecords(agent, did, 'me.attest.statement', 100),
      listRecords(agent, did, 'me.attest.profile', 1),
    ]);

    // Format proofs
    const proofs = proofsResult.records.map((r: any) => ({
      uri: r.uri,
      cid: r.cid,
      ...r.value,
    }));

    // Format keys
    const keys = keysResult.records.map((r: any) => ({
      uri: r.uri,
      cid: r.cid,
      ...r.value,
    }));

    // Format statements
    const statements = statementsResult.records.map((r: any) => ({
      uri: r.uri,
      cid: r.cid,
      ...r.value,
    }));

    // Get profile metadata
    const profileMeta = profileResult.records[0]?.value || {};

    res.json({
      did,
      handle,
      displayName: bskyProfile?.displayName || profileMeta.displayName,
      avatar: bskyProfile?.avatar || profileMeta.avatar,
      proofs,
      keys,
      statements,
      profile: profileMeta,
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message,
    });
  }
});

/**
 * POST /api/profile/:did/report
 * Generate a verification report
 */
router.post('/:did/report', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;

    // Fetch profile data
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const [proofsResult, keysResult] = await Promise.all([
      listRecords(agent, did, 'me.attest.proof', 100),
      listRecords(agent, did, 'me.attest.key', 100),
    ]);

    const report = {
      did,
      generatedAt: new Date().toISOString(),
      verifiedProofs: proofsResult.records.filter((r: any) => r.value.status === 'verified').length,
      totalProofs: proofsResult.records.length,
      publicKeys: keysResult.records.length,
      proofs: proofsResult.records.map((r: any) => ({
        service: r.value.service,
        handle: r.value.handle || r.value.identifier,
        status: r.value.status,
        verifiedAt: r.value.verifiedAt,
        proofUrl: r.value.proofUrl,
      })),
      keys: keysResult.records.map((r: any) => ({
        keyType: r.value.keyType,
        fingerprint: r.value.fingerprint,
        label: r.value.label,
      })),
    };

    // In a real implementation, you might save this report and generate a shareable URL
    // For now, we'll just return it as JSON
    const reportId = Buffer.from(`${did}-${Date.now()}`).toString('base64url');
    const reportUrl = `/reports/${reportId}`;

    res.json({
      reportUrl,
      report,
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error.message,
    });
  }
});

export default router;
```

---

## Task 4.7: Re-verification System

### Location
Update file: `server/routes/proofs.ts`

Add this endpoint:

```typescript
/**
 * POST /api/proofs/reverify
 * Re-verify an existing proof
 */
router.post('/reverify', async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: 'Missing required field: uri' });
    }

    // Fetch the existing proof record
    const agent = new AtpAgent({ service: session.pdsUrl });
    agent.session = session;

    const { value: proof } = await getRecord({ agent, did: session.did }, uri);

    // Re-verify the proof
    const verifier = getVerifierForService(proof.service);
    if (!verifier) {
      return res.status(400).json({ error: `No verifier for service: ${proof.service}` });
    }

    const result = await verifier.verify({
      did: session.did,
      handle: proof.handle || proof.identifier,
      challengeText: proof.challengeText,
      proofUrl: proof.proofUrl,
      signature: proof.signature,
    });

    // Update the proof record
    const updatedProof = {
      ...proof,
      status: result.verified ? 'verified' : 'unverified',
      lastCheckedAt: new Date().toISOString(),
      errorMessage: result.error || undefined,
    };

    await updateRecord(
      { agent, did: session.did },
      uri,
      updatedProof
    );

    res.json({
      success: true,
      verified: result.verified,
      status: updatedProof.status,
      lastCheckedAt: updatedProof.lastCheckedAt,
    });
  } catch (error: any) {
    console.error('Error re-verifying proof:', error);
    res.status(500).json({
      error: 'Failed to re-verify proof',
      message: error.message,
    });
  }
});
```

---

## Task 4.8: Background Re-verification Scheduler (Optional Advanced)

### Location
Create file: `server/lib/reverification-scheduler.ts`

### Implementation

```typescript
import { AtpAgent } from '@atproto/api';
import { listRecords, updateRecord } from './atproto-repo';
import { getVerifierForService } from '../services';

/**
 * Background job to periodically re-verify all proofs
 */
export async function scheduleReverification() {
  const REVERIFICATION_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

  setInterval(async () => {
    console.log('[Reverification] Starting scheduled re-verification...');
    await reverifyAllProofs();
  }, REVERIFICATION_INTERVAL);
}

async function reverifyAllProofs() {
  try {
    // In a production system, you'd maintain a database of all users
    // For now, this is a simplified example

    const agent = new AtpAgent({ service: 'https://bsky.social' });

    // Fetch all proofs that need re-verification (last checked > 7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // This is a placeholder - in reality, you'd query your database or PDS
    console.log('[Reverification] Re-verification logic would go here');

    // For each proof:
    // 1. Fetch proof record
    // 2. Run verifier
    // 3. Update proof status
    // 4. Log result
  } catch (error) {
    console.error('[Reverification] Error during scheduled re-verification:', error);
  }
}
```

---

## Routes Configuration

Add to `src/routes.tsx`:

```typescript
import { ProfilePage } from './pages/ProfilePage';
import { ProfileDetailsPage } from './pages/ProfileDetailsPage';

// Add these routes:
{
  path: '/:identifier',
  element: <ProfilePage />,
},
{
  path: '/:identifier/details',
  element: <ProfileDetailsPage />,
},
```

**Route behavior:**
- `/:identifier` — Simple LinkTree-style profile (default, public-facing)
- `/:identifier/details` — Technical details profile (advanced, power users)

**Keyboard shortcuts** (optional enhancement):
- `Shift + D` on simple profile → navigate to details
- `Shift + S` on details profile → navigate back to simple

---

## Acceptance Criteria

Phase 4 is complete when:

**Profile Routes & Views:**
- [ ] **Simple profile route (`/:identifier`) works with LinkTree-style layout**
- [ ] **Technical details route (`/:identifier/details`) works with full DID and proof details**
- [ ] **Simple profile shows verified accounts grid with visual checkmarks**
- [ ] **Technical details profile shows DID prominently with copy button**
- [ ] **Navigation between simple and details views works (footer links)**
- [ ] **Simple profile hides all technical jargon (no DIDs, signatures, etc.)**
- [ ] **Details profile shows challenge text, signatures, and replay verification**

**Proof Display:**
- [ ] SimpleProofCard component displays service icon, handle, and verification status
- [ ] SimpleProofCard links to actual external service (GitHub profile, Etherscan, etc.)
- [ ] DetailedProofCard shows full proof information with expandable details
- [ ] Proof status badges display correctly (✓ verified, ⚠ unverified, ✗ revoked, ⌛ expired)
- [ ] **Proof cards integrate client-side replay verification component**
- [ ] **Proof cards show server verification badge with cache status**
- [ ] **Expanded proof details show serverVerification metadata**

**Functionality:**
- [ ] Profile API endpoint returns complete user data (proofs, keys, statements)
- [ ] Re-verify all proofs button works on details page
- [ ] Individual proof re-verification works
- [ ] Copy DID button works on details page
- [ ] SSH/PGP key export links work
- [ ] Share profile button works on simple view
- [ ] **Both verification modes (client replay + server cached) are functional in UI**
- [ ] All verification components from Phase 2 are properly imported and used

**UI & UX:**
- [ ] Key cards display fingerprint, type, and expiration status
- [ ] Statement cards support signature verification
- [ ] Verification report can be exported and shared
- [ ] All components are styled consistently
- [ ] Profile pages are responsive on mobile devices
- [ ] Empty states are handled gracefully (no proofs, no keys, etc.)
- [ ] Error messages are user-friendly
- [ ] Loading states display correctly

**Testing:**
- [ ] All unit tests pass with >80% coverage
- [ ] Simple profile loads correctly for users with/without proofs
- [ ] Details profile loads correctly and displays all technical information
- [ ] Navigation between views preserves state
- [ ] External links open in new tabs

---

## Next Phase

Proceed to **Phase 5: Web of Trust** after all acceptance criteria are met.
