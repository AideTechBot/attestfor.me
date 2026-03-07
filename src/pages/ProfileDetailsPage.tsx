import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { DetailedClaimCard } from "@/components/Profile/DetailedClaimCard";
import { KeyCard } from "@/components/Profile/KeyCard";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";
import { listClaims, listKeys, type AtProtoRecord } from "@/lib/atproto";
import type {
  DevKeytraceClaim,
  DevKeytraceUserPublicKey,
} from "../../types/keytrace";
import { NAV, PROFILE, PROFILE_EMPTY } from "@/lib/ui-strings";
import { SUPPORTED_SERVICES } from "@/lib/run-verification";

interface ProfileDetailsData {
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
export async function profileDetailsLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileDetailsData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", did: "", isValid: false, claims: [], keys: [] };
  }

  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  try {
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
    console.error("[ProfileDetailsLoader] Error fetching profile:", error);
    return {
      handle: cleanHandle,
      did: "",
      isValid: false,
      claims: [],
      keys: [],
    };
  }
}

export function ProfileDetailsPage() {
  const profile = useLoaderData() as ProfileDetailsData;
  const [activeTab, setActiveTab] = useState<"claims" | "keys">("claims");
  const [copiedDid, setCopiedDid] = useState(false);

  if (!profile.isValid) {
    return <NotFoundContent />;
  }

  const activeClaims = profile.claims.filter(
    (p) =>
      p.value.status !== "retracted" && SUPPORTED_SERVICES.has(p.value.type),
  );
  const copyDid = async () => {
    await navigator.clipboard.writeText(profile.did);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Simple View Link */}
      <Link
        to={`/${profile.handle}`}
        className="-mx-6 -mt-6 flex items-center justify-end mb-6 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors no-underline"
      >
        {NAV.simpleView} <ArrowRight className="w-3.5 h-3.5 inline" />
      </Link>

      {/* Profile Header — centred, matching ProfilePage */}
      <div className="flex flex-col items-center gap-4 mb-2">
        {/* Avatar */}
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

        {/* Name / handle */}
        <div className="text-center">
          <h1 className="text-2xl m-0 mb-1">
            {profile.displayName || `@${profile.handle}`}
          </h1>
          {profile.displayName && (
            <div className="text-sm text-muted m-0">@{profile.handle}</div>
          )}
        </div>

        {/* DID — monospace tag, click to copy */}
        <button
          onClick={copyDid}
          title={PROFILE.copyDid}
          aria-label={PROFILE.copyDidToClipboard}
          className="inline-flex items-center gap-2 mt-[-8px] bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/35 transition-colors px-2.5 py-1 max-w-full cursor-pointer"
        >
          <span className="font-mono text-xs text-white/70 break-all leading-none">
            {profile.did}
          </span>
          <span className="shrink-0 flex items-center text-white/70">
            {copiedDid ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={PROFILE.profileSections}
        className="flex mb-6 border-b-2 border-surface-border"
      >
        <button
          role="tab"
          aria-selected={activeTab === "claims"}
          aria-controls="tab-panel-claims"
          onClick={() => setActiveTab("claims")}
          className={`flex-1 py-3 text-sm font-semibold border-b-3 -mb-0.5 transition-colors cursor-pointer bg-transparent ${
            activeTab === "claims"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-inherit"
          }`}
        >
          {PROFILE.claimsTab(activeClaims.length)}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "keys"}
          aria-controls="tab-panel-keys"
          onClick={() => setActiveTab("keys")}
          className={`flex-1 py-3 text-sm font-semibold border-b-3 -mb-0.5 transition-colors cursor-pointer bg-transparent ${
            activeTab === "keys"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-inherit"
          }`}
        >
          {PROFILE.keysTab(profile.keys.length)}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "claims" && (
        <div
          id="tab-panel-claims"
          role="tabpanel"
          className="flex flex-col gap-4"
        >
          {activeClaims.length > 0 ? (
            activeClaims.map((claim) => (
              <DetailedClaimCard key={claim.uri} claim={claim} />
            ))
          ) : (
            <div className="text-center py-12 text-muted">
              <p className="text-lg mb-1">{PROFILE_EMPTY.noClaims}</p>
              <p className="text-sm">{PROFILE_EMPTY.noClaimsDesc}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "keys" && (
        <div
          id="tab-panel-keys"
          role="tabpanel"
          className="flex flex-col gap-4"
        >
          {profile.keys.length > 0 ? (
            profile.keys.map((key) => <KeyCard key={key.uri} keyRecord={key} />)
          ) : (
            <div className="text-center py-12 text-muted">
              <p className="text-lg mb-1">{PROFILE_EMPTY.noKeys}</p>
              <p className="text-sm">{PROFILE_EMPTY.noKeysDesc}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
