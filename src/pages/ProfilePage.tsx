import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { SimpleProofCard } from "@/components/Profile/SimpleProofCard";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";
import { listProofs, listKeys, type AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof, MeAttestKey } from "../../types/lexicons";
import { getProofStatusLabel } from "@/lib/proof-status-label";
import { useVerificationStatuses } from "@/lib/verification-context";

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

// ── Stub data for UI preview (remove when real data is available) ──
const USE_STUB_DATA = true;

const STUB_PROOFS: AtProtoRecord<MeAttestProof.Main>[] = [
  {
    uri: "at://did:plc:stub1234/me.attest.proof/github1",
    cid: "bafyreig1234567890abcdefghijklmnopqrstuvwxyz",
    value: {
      $type: "me.attest.proof",
      service: "github",
      handle: "manoo-bafyrei",
      proofUrl: "https://gist.github.com/manoo-bafyrei/abc123",
      nonce: "a7f3b2c9e1d4f6a8b0c2d4e6f8a0b2c4",
      challengeText:
        "I am manoo.dev on Bluesky. Nonce: a7f3b2c9e1d4f6a8b0c2d4e6f8a0b2c4",
      status: "active",
      createdAt: "2025-12-01T10:00:00.000Z",
    },
  },
  {
    uri: "at://did:plc:stub1234/me.attest.proof/twitter1",
    cid: "bafyreig0987654321zyxwvutsrqponmlkjihgfedcba",
    value: {
      $type: "me.attest.proof",
      service: "twitter",
      handle: "@manoo_dev",
      proofUrl: "https://x.com/manoo_dev/status/1234567890",
      nonce: "d4e6f8a0b2c4a7f3b2c9e1d4f6a8b0c2",
      challengeText:
        "I am manoo.dev on Bluesky. Nonce: d4e6f8a0b2c4a7f3b2c9e1d4f6a8b0c2",
      status: "active",
      createdAt: "2025-12-15T14:30:00.000Z",
    },
  },
  {
    uri: "at://did:plc:stub1234/me.attest.proof/github2",
    cid: "bafyreihabcdefghijklmnopqrstuvwxyz123456789",
    value: {
      $type: "me.attest.proof",
      service: "github",
      handle: "old-github-handle",
      proofUrl: "https://gist.github.com/old-github-handle/xyz789",
      nonce: "f8a0b2c4a7f3b2c9e1d4f6a8b0c2d4e6",
      challengeText:
        "I am manoo.dev on Bluesky. Nonce: f8a0b2c4a7f3b2c9e1d4f6a8b0c2d4e6",
      status: "retracted",
      createdAt: "2025-11-01T08:00:00.000Z",
      retractedAt: "2025-11-20T16:00:00.000Z",
    },
  },
];

const STUB_KEYS: AtProtoRecord<MeAttestKey.Main>[] = [
  {
    uri: "at://did:plc:stub1234/me.attest.key/pgp1",
    cid: "bafyreipgpkey1234567890abcdefghijklmnopqrst",
    value: {
      $type: "me.attest.key",
      keyType: "pgp",
      publicKey:
        "-----BEGIN PGP PUBLIC KEY BLOCK-----\nmQINBGV...example...\n-----END PGP PUBLIC KEY BLOCK-----",
      fingerprint: "A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2",
      label: "Personal signing key",
      comment: "Used for signing commits and emails",
      status: "active",
      createdAt: "2025-10-15T12:00:00.000Z",
      expiresAt: "2027-10-15T12:00:00.000Z",
    },
  },
  {
    uri: "at://did:plc:stub1234/me.attest.key/ssh1",
    cid: "bafyreisshkey1234567890abcdefghijklmnopqrst",
    value: {
      $type: "me.attest.key",
      keyType: "ssh-ed25519",
      publicKey:
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyDataHere manoo@workstation",
      fingerprint: "SHA256:xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
      label: "Work laptop",
      status: "active",
      createdAt: "2025-11-01T09:00:00.000Z",
    },
  },
];

// eslint-disable-next-line react-refresh/only-export-components
export async function profileLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", did: "", isValid: false, proofs: [], keys: [] };
  }

  // Remove @ prefix if present (handle comes from URL like /@manoo.dev)
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Skip requests for static files that hit the /:handle route (e.g. favicon.ico)
  if (
    /\.(ico|png|jpg|jpeg|svg|webp|gif|js|css|map|json|txt|xml|webmanifest)$/i.test(
      cleanHandle,
    )
  ) {
    return {
      handle: cleanHandle,
      did: "",
      isValid: false,
      proofs: [],
      keys: [],
    };
  }

  try {
    // Same code runs on both server (SSR) and client (navigation).
    // getProfile calls the Bluesky public API directly.
    const profile = await getProfile(cleanHandle);
    if (!profile) {
      return {
        handle: cleanHandle,
        did: "",
        isValid: false,
        proofs: [],
        keys: [],
      };
    }

    // Fetch proofs and keys in parallel using the DID
    const [proofs, keys] = USE_STUB_DATA
      ? [STUB_PROOFS, STUB_KEYS]
      : await Promise.all([
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
    return {
      handle: cleanHandle,
      did: "",
      isValid: false,
      proofs: [],
      keys: [],
    };
  }
}

// ── Stub verification (remove when real verification is ready) ──
export function ProfilePage() {
  const profile = useLoaderData() as ProfileData;

  const activeProofs = profile.isValid
    ? profile.proofs.filter((p) => p.value.status !== "retracted")
    : [];

  const [copied, setCopied] = useState(false);

  // Read statuses for the summary label — each SimpleProofCard manages its
  // own verification, we just need the statuses for getProofStatusLabel.
  const proofStatuses = useVerificationStatuses(activeProofs.map((p) => p.uri));

  if (!profile.isValid) {
    return <NotFoundContent />;
  }

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: `${profile.displayName || profile.handle} on AttestFor.me`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Profile Section */}
      <div className="flex flex-col items-center gap-6 max-w-xl mx-auto w-full h-full">
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

        {/* Verification Status Label */}
        {activeProofs.length > 0 &&
          (() => {
            const { label, colour } = getProofStatusLabel(
              activeProofs.length,
              proofStatuses,
            );
            const cls = {
              neutral: "border-surface-border text-muted",
              green: "border-green-500/30 text-green-400",
              yellow: "border-yellow-500/30 text-yellow-400",
              red: "border-red-500/30 text-red-400",
            }[colour];
            return (
              <div
                className={`inline-flex items-center px-4 py-2 border text-sm font-semibold ${cls}`}
              >
                {label}
              </div>
            );
          })()}

        {/* Verified Accounts List */}
        {activeProofs.length > 0 ? (
          <div className="flex flex-col gap-3 w-full">
            {activeProofs.map((proof) => (
              <SimpleProofCard key={proof.uri} proof={proof} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-lg mb-1">No verified accounts yet</p>
            <p className="text-sm">
              This user hasn&apos;t linked any external accounts.
            </p>
          </div>
        )}

        {/* Share button — above the rule */}
        {/* Bottom section — pushed to the bottom of the card */}
        <div className="mt-auto flex flex-col items-center gap-0 w-full">
          <button
            onClick={handleShare}
            className="px-4 py-2 border border-surface-border bg-surface text-sm cursor-pointer hover:border-muted hover:-translate-y-0.5 active:translate-y-0 transition-all min-w-36 mb-4"
          >
            {copied ? "✓ Copied!" : "Share profile"}
          </button>

          <div className="flex flex-col items-center pt-3 border-t border-surface-border w-full">
            <Link
              to={`/${profile.handle}/details`}
              className="text-xs text-muted hover:text-white transition-colors"
            >
              View technical details →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
