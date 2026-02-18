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
