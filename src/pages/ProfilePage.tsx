import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState, useRef, useCallback } from "react";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { SimpleClaimCard } from "@/components/Profile/SimpleClaimCard";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";
import { listClaims, listKeys, type AtProtoRecord } from "@/lib/atproto";
import type {
  DevKeytraceClaim,
  DevKeytraceUserPublicKey,
} from "../../types/keytrace";
import { Share2, Check } from "lucide-react";
import { getClaimStatusLabel } from "@/lib/claim-status-label";
import {
  useVerificationStatuses,
  useVerificationDispatch,
} from "@/lib/verification-context";
import { SUPPORTED_SERVICES, runVerification } from "@/lib/run-verification";
import { PROFILE, PROFILE_EMPTY, NAV, META } from "@/lib/ui-strings";
import { useDocumentTitle } from "@/lib/hooks";

interface ProfileData {
  handle: string;
  did: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  isValid: boolean;
  claims: AtProtoRecord<DevKeytraceClaim.Main>[];
  keys: AtProtoRecord<DevKeytraceUserPublicKey.Main>[];
}

// eslint-disable-next-line react-refresh/only-export-components
export async function profileLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", did: "", isValid: false, claims: [], keys: [] };
  }

  // Remove @ prefix if present (in case user types @handle in URL)
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
      claims: [],
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
        claims: [],
        keys: [],
      };
    }

    // Fetch claims and keys in parallel using the DID
    const [claims, keys] = await Promise.all([
      listClaims(profile.did).catch(() => []),
      listKeys(profile.did).catch(() => []),
    ]);

    return {
      handle: profile.handle,
      did: profile.did,
      displayName: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      isValid: true,
      claims,
      keys,
    };
  } catch (error) {
    console.error("[ProfileLoader] Error fetching profile:", error);
    return {
      handle: cleanHandle,
      did: "",
      isValid: false,
      claims: [],
      keys: [],
    };
  }
}

// ── Stub verification (remove when real verification is ready) ──
export function ProfilePage() {
  const profile = useLoaderData() as ProfileData;

  useDocumentTitle(
    profile.isValid
      ? META.profileTitle(profile.displayName || profile.handle, profile.handle)
      : META.notFoundTitle,
  );

  const activeClaims = profile.isValid
    ? profile.claims.filter(
        (p) => !p.value.retractedAt && SUPPORTED_SERVICES.has(p.value.type),
      )
    : [];

  const [copied, setCopied] = useState(false);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const verifyingAllRef = useRef(false);

  const dispatch = useVerificationDispatch();

  // Read statuses for the summary label — each SimpleClaimCard manages its
  // own verification, we just need the statuses for getClaimStatusLabel.
  const claimStatuses = useVerificationStatuses(activeClaims.map((p) => p.uri));

  const handleVerifyAll = useCallback(async () => {
    if (verifyingAllRef.current) {
      return;
    }
    verifyingAllRef.current = true;
    setVerifyingAll(true);
    try {
      for (const claim of activeClaims) {
        // Only verify claims that haven't been attempted yet
        const idx = activeClaims.indexOf(claim);
        const status = claimStatuses[idx];
        if (status !== "idle") {
          continue;
        }
        await runVerification(claim, dispatch);
      }
    } finally {
      verifyingAllRef.current = false;
      setVerifyingAll(false);
    }
  }, [activeClaims, claimStatuses, dispatch]);

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

        {/* Verification Status Label + Share Icon */}
        {activeClaims.length > 0 &&
          (() => {
            const { label, colour } = getClaimStatusLabel(
              activeClaims.length,
              claimStatuses,
            );
            const cls = {
              neutral: "border-surface-border text-muted",
              green: "border-green-500/30 text-green-400",
              yellow: "border-yellow-500/30 text-yellow-400",
              red: "border-red-500/30 text-red-400",
            }[colour];
            return (
              <div className="flex items-stretch gap-3 w-full min-w-0">
                <button
                  onClick={handleVerifyAll}
                  disabled={verifyingAll}
                  title={PROFILE.verifyAll}
                  aria-label={PROFILE.verifyAll}
                  className={`flex-1 min-w-0 flex items-center justify-center px-4 py-2 border text-sm font-semibold bg-transparent cursor-pointer hover:brightness-125 transition-all disabled:cursor-default disabled:opacity-70 ${cls}`}
                >
                  {label}
                </button>
                <div className="relative shrink-0 flex">
                  <button
                    onClick={handleShare}
                    title={PROFILE.shareProfile}
                    aria-label={PROFILE.shareProfile}
                    className="w-9 flex items-center justify-center border border-surface-border text-muted hover:text-white hover:border-muted cursor-pointer transition-colors bg-transparent"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                  </button>
                  {copied && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-surface border border-surface-border text-xs text-white whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                      {PROFILE.copied}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

        {/* Verified Accounts List */}
        {activeClaims.length > 0 ? (
          <div className="flex flex-col gap-3 w-full">
            {activeClaims.map((claim) => (
              <SimpleClaimCard key={claim.uri} claim={claim} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-lg mb-1">{PROFILE_EMPTY.noAccounts}</p>
            <p className="text-sm">{PROFILE_EMPTY.noAccountsDesc}</p>
          </div>
        )}

        {/* Bottom section — pushed to the bottom of the card */}
        <div className="mt-auto flex flex-col items-center gap-0 w-full">
          <div className="flex flex-col items-center pt-3 border-t border-surface-border w-full">
            <Link
              to={`/${profile.handle}/details`}
              className="text-xs text-muted hover:text-white transition-colors"
            >
              {NAV.viewDetails}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
