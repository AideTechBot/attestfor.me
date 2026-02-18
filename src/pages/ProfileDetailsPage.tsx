import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { DetailedProofCard } from "@/components/Profile/DetailedProofCard";
import { KeyCard } from "@/components/Profile/KeyCard";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";
import { listProofs, listKeys, type AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof, MeAttestKey } from "../../types/lexicons";

interface ProfileDetailsData {
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
export async function profileDetailsLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileDetailsData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", did: "", isValid: false, proofs: [], keys: [] };
  }

  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  try {
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
    console.error("[ProfileDetailsLoader] Error fetching profile:", error);
    return {
      handle: cleanHandle,
      did: "",
      isValid: false,
      proofs: [],
      keys: [],
    };
  }
}

export function ProfileDetailsPage() {
  const profile = useLoaderData() as ProfileDetailsData;
  const [activeTab, setActiveTab] = useState<"proofs" | "keys">("proofs");
  const [copiedDid, setCopiedDid] = useState(false);

  if (!profile.isValid) {
    return <NotFoundContent />;
  }

  const activeProofs = profile.proofs.filter(
    (p) => p.value.status !== "retracted",
  );
  const copyDid = async () => {
    await navigator.clipboard.writeText(profile.did);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Back Link */}
      <Link
        to={`/${profile.handle}`}
        className="-mx-6 -mt-6 flex items-center mb-6 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors no-underline"
      >
        ← Simple view
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
          title="Copy DID"
          aria-label="Copy DID to clipboard"
          className="inline-flex items-center gap-2 mt-[-8px] bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/35 transition-colors px-2.5 py-1 max-w-full cursor-pointer"
        >
          <span className="font-mono text-xs text-white/70 break-all leading-none">
            {profile.did}
          </span>
          <span className="shrink-0 flex items-center text-white/70">
            {copiedDid ? (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 7L5.5 10L11.5 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect
                  x="4"
                  y="1"
                  width="9"
                  height="10"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <rect
                  x="1"
                  y="4"
                  width="9"
                  height="10"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                />
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex mb-6 border-b-2 border-surface-border">
        <button
          onClick={() => setActiveTab("proofs")}
          className={`flex-1 py-3 text-sm font-semibold border-b-3 -mb-0.5 transition-colors cursor-pointer bg-transparent ${
            activeTab === "proofs"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-inherit"
          }`}
        >
          Proofs ({activeProofs.length})
        </button>
        <button
          onClick={() => setActiveTab("keys")}
          className={`flex-1 py-3 text-sm font-semibold border-b-3 -mb-0.5 transition-colors cursor-pointer bg-transparent ${
            activeTab === "keys"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-inherit"
          }`}
        >
          Keys ({profile.keys.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "proofs" && (
        <div className="flex flex-col gap-4">
          {activeProofs.length > 0 ? (
            activeProofs.map((proof) => (
              <DetailedProofCard key={proof.uri} proof={proof} />
            ))
          ) : (
            <div className="text-center py-12 text-muted">
              <p className="text-lg mb-1">No proofs found</p>
              <p className="text-sm">
                This user hasn&apos;t published any identity proofs yet.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "keys" && (
        <div className="flex flex-col gap-4">
          {profile.keys.length > 0 ? (
            profile.keys.map((key) => <KeyCard key={key.uri} keyRecord={key} />)
          ) : (
            <div className="text-center py-12 text-muted">
              <p className="text-lg mb-1">No keys published</p>
              <p className="text-sm">
                This user hasn&apos;t published any public keys yet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
